import connection, { IConnection } from './connection';
import NotificationsStore from './NotificationsStore';
import UserConnectionsStore from './UserConnectionsStore';
import UsersStore from './UsersStore';
import VerificationCodesStore from './VerificationCodesStore';

class Store {
    db: IConnection;

    users: UsersStore;

    userConnections: UserConnectionsStore;

    notifications: NotificationsStore;

    verificationCodes: VerificationCodesStore;

    constructor(dbConnection) {
        this.db = dbConnection;

        this.users = new UsersStore(this.db);
        this.userConnections = new UserConnectionsStore(this.db);
        this.notifications = new NotificationsStore(this.db);
        this.verificationCodes = new VerificationCodesStore(this.db);
    }
}

export default new Store(connection);
