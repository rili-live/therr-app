import logSpan from 'therr-js-utilities/log-or-update-span';
import { InternalConfigHeaders } from 'therr-js-utilities/internal-rest-request';
import { getBrandContext } from 'therr-js-utilities/http';
import Store from '../store';
import { createReactions } from './reactions';

const randomIntFromInterval = (min, max) => Math.floor(Math.random() * (max - min + 1) + min);

// Multiplier applied to an interest-matched thought's hot score before it is persisted as
// the reaction's relevanceScore. Keeps interest matches above equally-hot general fill
// without hard-partitioning the stream into two blocks.
const INTEREST_MATCH_BOOST = 1.5;

class TherrEventEmitter {
    /**
     * Activates a batch of candidate thoughts for the requesting user's stream.
     * Candidates are ranked by engagement-aware hot score (see ThoughtsStore.getRecentThoughts):
     * thoughts matching the user's interests lead, top generally-hot thoughts fill the rest.
     * `shouldIncludeGeneralCandidates` (recentUsersCount > 0) widens the batch beyond
     * interest matches — used at login; the lighter notifications-poll path activates
     * interest matches only (with a single-thought fallback).
     */
    // eslint-disable-next-line class-methods-use-this
    public runThoughtDistributorAlgorithm(headers: InternalConfigHeaders, contextUserIds?: string[], createdAtOrUpdatedAt = 'createdAt', recentUsersCount = 1) {
        const numThoughts = randomIntFromInterval(7, 20);
        const { brandVariation: brand } = getBrandContext(headers as any);
        const shouldIncludeGeneralCandidates = recentUsersCount > 0;
        const getContextUsersPromise = contextUserIds?.length
            ? Store.users.findUsersWithInterests({
                ids: contextUserIds,
            }, ['id'])
            : Promise.resolve([]);
        return getContextUsersPromise.then((contextUsers) => {
            const interestsKeys = contextUsers
                .reduce((acc, cur) => [...acc, ...(cur?.userInterests || []).map((i: any) => i.displayNameKey)], []);
            return Promise.all([
                interestsKeys.length
                    ? Store.thoughts.getRecentThoughts(brand, numThoughts, interestsKeys)
                    : Promise.resolve([]),
                Store.thoughts.getRecentThoughts(brand, numThoughts),
            ]);
        }).then(([thoughtsForContext, thoughtsForRecent]) => {
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
                interestMatches.forEach((thought) => recordScore(thought, INTEREST_MATCH_BOOST));
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
            return createReactions(Array.from(thoughtIds), headers, relevanceScores);
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
