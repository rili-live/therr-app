import Store from '../store';
import { createReactions } from './reactions';

class TherrEventEmitter {
    // TODO: Query user interests and create reactions based on those interests
    // eslint-disable-next-line class-methods-use-this
    public runThoughtReactionDistributorAlgorithm(contextUserId: string) {
        return Store.users.getRecentUsers(1)
            .then((users) => Store.thoughts.getRecentThoughts(3).then((thoughts) => {
                const promises: Promise<any>[] = [];
                users
                    .forEach((user) => {
                        // Create new reactions for the user who just logged in and several other recent users
                        promises.push(
                            createReactions(thoughts.map((thought) => thought.id), {
                                'x-userid': user.id,
                            }),
                            createReactions(thoughts.map((thought) => thought.id), {
                                'x-userid': contextUserId,
                            }),
                        );
                    });

                return Promise.all(promises);
            }))
            .catch((err) => {
                // TODO: Send to Honeycomb/DataDog
                console.log(err);
            });
    }
}

export default new TherrEventEmitter();
