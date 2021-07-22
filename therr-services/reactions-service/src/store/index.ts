import connection, { IConnection } from './connection';
import MomentReactionsStore from './MomentReactionsStore';

class Store {
    db: IConnection;

    momentReactions: MomentReactionsStore;

    constructor(dbConnection) {
        this.db = dbConnection;

        this.momentReactions = new MomentReactionsStore(this.db);
    }
}

export default new Store(connection);
