import logSpan from 'therr-js-utilities/log-or-update-span';
import { InternalConfigHeaders } from 'therr-js-utilities/internal-rest-request';
import { getBrandContext } from 'therr-js-utilities/http';
import { getAlgorithmProfile, getDefaultAlgorithmProfile } from 'therr-js-utilities/content-ranking';
import Store from '../store';
import { tryAcquireDistributorRun } from '../store/redisClient';
import { createReactions } from './reactions';

const randomIntFromInterval = (min, max) => Math.floor(Math.random() * (max - min + 1) + min);

/**
 * The context user whose content algorithm may rank this run, or `undefined` when the run
 * cannot be attributed to one.
 *
 * Prefers the `x-userid` header because that is the identity the resulting reaction rows are
 * written under. Falls back to a single-user context list, which names its owner
 * unambiguously even when the trigger carries no authenticated header.
 */
const resolveProfileOwner = (headers: InternalConfigHeaders, contextUsers: any[]): any | undefined => {
    const headerUserId = headers?.['x-userid'];
    if (headerUserId) {
        return contextUsers.find((user) => user?.id === headerUserId);
    }

    return contextUsers.length === 1 ? contextUsers[0] : undefined;
};

class TherrEventEmitter {
    /**
     * Activates a batch of candidate thoughts for the requesting user's stream.
     * Candidates are ranked by engagement-aware hot score (see ThoughtsStore.getRecentThoughts):
     * thoughts matching the user's interests lead, top generally-hot thoughts fill the rest.
     * `shouldIncludeGeneralCandidates` (recentUsersCount > 0) widens the batch beyond
     * interest matches — used at login; the lighter notifications-poll path activates
     * interest matches only (with a single-thought fallback).
     *
     * `minSecondsBetweenRuns` gates repeat runs for the same user (see
     * tryAcquireDistributorRun). The notifications-poll caller sets it because it fires on
     * every poll; login leaves it at 0 so a fresh session always seeds the stream.
     */
    // eslint-disable-next-line class-methods-use-this
    public async runThoughtDistributorAlgorithm(
        headers: InternalConfigHeaders,
        contextUserIds?: string[],
        createdAtOrUpdatedAt = 'createdAt',
        recentUsersCount = 1,
        minSecondsBetweenRuns = 0,
    ) {
        const gateUserId = contextUserIds?.length === 1 ? contextUserIds[0] : undefined;
        if (minSecondsBetweenRuns > 0 && gateUserId) {
            const acquired = await tryAcquireDistributorRun(gateUserId, minSecondsBetweenRuns);
            if (!acquired) {
                return {};
            }
        }

        const { brandVariation: brand } = getBrandContext(headers as any);
        const shouldIncludeGeneralCandidates = recentUsersCount > 0;
        const getContextUsersPromise = contextUserIds?.length
            ? Store.users.findUsersWithInterests({
                ids: contextUserIds,
            }, ['id', 'settingsContentAlgorithm'])
            : Promise.resolve([]);
        return getContextUsersPromise.then((contextUsers) => {
            const interestsKeys = contextUsers
                .reduce((acc, cur) => [...acc, ...(cur?.userInterests || []).map((i: any) => i.displayNameKey)], []);

            // Whose algorithm gets to rank this run.
            //
            // Every reaction this run creates is stamped with the `x-userid` header, not with a
            // context user id (reactions-service `createOrUpdateMultiThoughtReactions` reads the
            // header and ignores the body for identity). So the header user is the one whose
            // stream is being scored, and therefore the only one whose profile may score it —
            // `contextUserIds` is an input to *candidate selection*, and a batched caller could
            // legitimately name people other than the reaction owner.
            //
            // Resolving off the context list instead would let a batch stamp one user's rows
            // with another user's `algorithmKey`, breaking the invariant that column exists to
            // make observable: at steady state a user's activated rows are scored under their
            // current profile or not at all.
            //
            // Falling back to the single context user keeps the internal callers that trigger a
            // seed without an authenticated header (login) resolving the profile they intend —
            // a one-user run names its owner unambiguously. Only a batch we cannot attribute
            // takes the default.
            const targetUser = resolveProfileOwner(headers, contextUsers);
            const profile = targetUser
                ? getAlgorithmProfile(targetUser.settingsContentAlgorithm)
                : getDefaultAlgorithmProfile();
            const numThoughts = randomIntFromInterval(profile.minActivationBatch, profile.maxActivationBatch);

            // A hard interest filter with no interests to filter on would return nothing at
            // all — a permanently empty feed for SSO and onboarding-skip users, who are
            // exactly the population that has no userInterests rows (ALGORITHM_AUDIT E2).
            // FOCUS therefore only suppresses general candidates once there is a real
            // interest set to be strict about.
            const shouldSuppressGeneral = profile.hardInterestFilter && interestsKeys.length > 0;
            const generalLimit = shouldIncludeGeneralCandidates ? numThoughts : 1;

            return Promise.all([
                interestsKeys.length
                    ? Store.thoughts.getRecentThoughts(brand, numThoughts, interestsKeys, ['id'], profile)
                    : Promise.resolve([]),
                // When general candidates aren't being added to the batch, this result is
                // only consulted for a single fallback thought — ranking a full page of
                // candidates just to discard all but one was wasted work on every poll.
                shouldSuppressGeneral
                    ? Promise.resolve([])
                    : Store.thoughts.getRecentThoughts(brand, generalLimit, [], ['id'], profile),
            ]).then(([thoughtsForContext, thoughtsForRecent]) => [thoughtsForContext, thoughtsForRecent, profile] as const);
        }).then(([thoughtsForContext, thoughtsForRecent, profile]) => {
            const interestMatches = thoughtsForContext || [];
            const generalMatches = thoughtsForRecent || [];
            const thoughtIds = new Set<string>();
            // Scores ride along to the reaction rows so the stream can be ordered by relevance
            // on read. Highest score wins when a thought appears in both candidate sets.
            const relevanceScores: { [thoughtId: string]: number } = {};
            const recordScore = (thought: any, boost: number) => {
                if (!thought?.id) {
                    return;
                }
                const score = (Number(thought.hotScore) || 0) * boost;
                if (relevanceScores[thought.id] == null || score > relevanceScores[thought.id]) {
                    relevanceScores[thought.id] = score;
                }
                thoughtIds.add(thought.id);
            };

            if (interestMatches.length) {
                // "Interest matches lead" is the documented intent of this algorithm but was
                // previously unenforceable, since ordering was lost at activation. The boost
                // keeps an interest match ahead of a general candidate of equal hotness.
                interestMatches.forEach((thought) => recordScore(thought, profile.interestMatchBoost));
            } else {
                // If no new thoughts match user interests, fallback to the hottest general thought
                generalMatches.slice(0, 1).forEach((thought) => recordScore(thought, 1));
            }

            if (shouldIncludeGeneralCandidates) {
                generalMatches.forEach((thought) => recordScore(thought, 1));
            }

            if (!thoughtIds.size) {
                return Promise.resolve({});
            }

            // Reactions are stamped with the requesting user's id (from headers), so one
            // deduplicated call activates the whole batch
            return createReactions(Array.from(thoughtIds), headers, relevanceScores, profile.key);
        })
            .catch((err) => {
                logSpan({
                    level: 'error',
                    messageOrigin: 'TherrEventEmitter',
                    messages: [err?.message],
                    traceArgs: {
                        issue: 'error while running thought reaction distributor algorithm',
                    },
                });
            });
    }
}

export default new TherrEventEmitter();
