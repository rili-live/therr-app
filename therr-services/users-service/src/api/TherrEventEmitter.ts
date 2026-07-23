import logSpan from 'therr-js-utilities/log-or-update-span';
import { InternalConfigHeaders } from 'therr-js-utilities/internal-rest-request';
import { getBrandContext } from 'therr-js-utilities/http';
import Store from '../store';
import { createReactions } from './reactions';

const randomIntFromInterval = (min, max) => Math.floor(Math.random() * (max - min + 1) + min);

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
            // If no new thoughts match user interests, fallback to the hottest general thought
            const contextReactionThoughts = thoughtsForContext?.length ? thoughtsForContext : thoughtsForRecent.slice(0, 1);
            const thoughtIds = new Set<string>(contextReactionThoughts.map((thought) => thought.id));
            if (shouldIncludeGeneralCandidates) {
                thoughtsForRecent.forEach((thought) => thoughtIds.add(thought.id));
            }

            if (!thoughtIds.size) {
                return Promise.resolve({});
            }

            // Reactions are stamped with the requesting user's id (from headers), so one
            // deduplicated call activates the whole batch
            return createReactions(Array.from(thoughtIds), headers);
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
