import connection, { IConnection } from './connection';
import MomentReactionsStore from './MomentReactionsStore';
import SpaceReactionsStore from './SpaceReactionsStore';

class Store {
    db: IConnection;

    momentReactions: MomentReactionsStore;

    spaceReactions: SpaceReactionsStore;

    constructor(dbConnection) {
        this.db = dbConnection;

        this.momentReactions = new MomentReactionsStore(this.db);

        this.spaceReactions = new SpaceReactionsStore(this.db);
    }
}

export default new Store(connection);
