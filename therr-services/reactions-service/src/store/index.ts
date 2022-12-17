import connection, { IConnection } from './connection';
import MomentReactionsStore from './MomentReactionsStore';
import SpaceReactionsStore from './SpaceReactionsStore';
import ThoughtReactionsStore from './ThoughtReactionsStore';

class Store {
    db: IConnection;

    momentReactions: MomentReactionsStore;

    spaceReactions: SpaceReactionsStore;

    thoughtReactions: ThoughtReactionsStore;

    constructor(dbConnection) {
        this.db = dbConnection;

        this.momentReactions = new MomentReactionsStore(this.db);

        this.spaceReactions = new SpaceReactionsStore(this.db);

        this.thoughtReactions = new ThoughtReactionsStore(this.db);
    }
}

export default new Store(connection);
