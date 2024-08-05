import logSpan from 'therr-js-utilities/log-or-update-span';
import Store from '../store';
import { createReactions } from './reactions';

const randomIntFromInterval = (min, max) => Math.floor(Math.random() * (max - min + 1) + min);

class TherrEventEmitter {
    // TODO: Query user interests and create reactions based on those interests
    // eslint-disable-next-line class-methods-use-this
    public runThoughtDistributorAlgorithm(contextUserIds?: string[], createdAtOrUpdatedAt = 'createdAt', recentUsersCount = 1) {
        const numThoughts = randomIntFromInterval(3, 7);
        const getContextUsersPromise = contextUserIds?.length
            ? Store.users.findUsersWithInterests({
                ids: contextUserIds,
            }, ['id'])
            : Promise.resolve([]);
        const getRecentUsersPromise = recentUsersCount > 0
            ? Store.users.getRecentUsers(recentUsersCount, ['id'], createdAtOrUpdatedAt)
            : Promise.resolve([]);
        return Promise.all([
            getContextUsersPromise,
            getRecentUsersPromise,
        ]).then(([
            contextUsers,
            recentUsers,
        ]) => Promise.all([
            Store.thoughts.getRecentThoughts(numThoughts, contextUsers
                .reduce((acc, cur) => [...acc, ...(cur?.userInterests || []).map((i: any) => i.displayNameKey)], [])),
            Store.thoughts.getRecentThoughts(numThoughts),
        ]).then(([thoughtsForContext, thoughtsForRecent]) => {
            const promises: Promise<any>[] = [];
            // If no new thoughts match user interests, fallback to unfiltered thought
            const contextReactionThoughts = thoughtsForContext?.length ? thoughtsForContext : thoughtsForRecent.slice(0, 1);
            if (contextReactionThoughts.length) {
                contextUsers
                    .forEach((user) => {
                        promises.push(
                            createReactions(contextReactionThoughts.map((thought) => thought.id), {
                                'x-userid': user.id,
                            }),
                        );
                    });
            }
            if (thoughtsForRecent.length) {
                recentUsers
                    .forEach((user) => {
                        promises.push(
                            createReactions(thoughtsForRecent.map((thought) => thought.id), {
                                'x-userid': user.id,
                            }),
                        );
                    });
            }

            return Promise.all(promises);
        }))
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
