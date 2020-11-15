import connection, { IConnection } from './connection';
import MomentsStore from './MomentsStore';

class Store {
    db: IConnection;

    moments: MomentsStore;

    constructor(dbConnection) {
        this.db = dbConnection;

        this.moments = new MomentsStore(this.db);
    }
}

export default new Store(connection);
