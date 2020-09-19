import connection, { IConnection } from './connection';
import NotificationsStore from './NotificationsStore';
import UserConnectionsStore from './UserConnectionsStore';
import UsersStore from './UsersStore';

class Store {
    db: IConnection;

    users: UsersStore;

    userConnections: UserConnectionsStore;

    notifications: NotificationsStore;

    constructor(dbConnection) {
        this.db = dbConnection;

        this.users = new UsersStore(this.db);
        this.userConnections = new UserConnectionsStore(this.db);
        this.notifications = new NotificationsStore(this.db);
    }
}

export default new Store(connection);
