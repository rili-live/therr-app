import connection, { IConnection } from './connection';
import DirectMessagesStore from './DirectMessagesStore';

class Store {
    db: IConnection;

    directMessages: DirectMessagesStore;

    constructor(dbConnection) {
        this.db = dbConnection;

        this.directMessages = new DirectMessagesStore(this.db);
    }
}

export default new Store(connection);
