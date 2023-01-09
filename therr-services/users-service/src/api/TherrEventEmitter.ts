import Store from '../store';
import { createReactions } from './reactions';

class TherrEventEmitter {
    // eslint-disable-next-line class-methods-use-this
    public runThoughtReactionDistributorAlgorithm() {
        return Store.users.getRecentUsers(2)
            .then((users) => Store.thoughts.getRecentThoughts(3).then((thoughts) => {
                const promises: Promise<any>[] = users
                    .map((user) => createReactions(thoughts.map((thought) => thought.id), {
                        'x-userid': user.id,
                    }));

                return Promise.all(promises);
            }))
            .catch((err) => {
                // TODO: Send to Honeycomb/DataDog
                console.log(err);
            });
    }
}

export default new TherrEventEmitter();
