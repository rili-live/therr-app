import logSpan from 'therr-js-utilities/log-or-update-span';
import Store from '../store';
import { createReactions } from './reactions';

const randomIntFromInterval = (min, max) => Math.floor(Math.random() * (max - min + 1) + min);

class TherrEventEmitter {
    // TODO: Query user interests and create reactions based on those interests
    // eslint-disable-next-line class-methods-use-this
    public runThoughtReactionDistributorAlgorithm(contextUserId: string, createdAtOrUpdatedAt = 'createdAt', userCount = 1) {
        const numThoughts = randomIntFromInterval(3, 7);
        return Store.users.getRecentUsers(userCount, ['id'], createdAtOrUpdatedAt)
            .then((users) => Store.thoughts.getRecentThoughts(numThoughts).then((thoughts) => {
                const promises: Promise<any>[] = [];
                // New reactions for the user who just logged in
                promises.push(
                    createReactions(thoughts.map((thought) => thought.id), {
                        'x-userid': contextUserId,
                    }),
                );
                users
                    .forEach((user) => {
                        // Create new reactions for the user who just logged in and several other recent users
                        promises.push(
                            createReactions(thoughts.map((thought) => thought.id), {
                                'x-userid': user.id,
                            }),
                        );
                    });

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
