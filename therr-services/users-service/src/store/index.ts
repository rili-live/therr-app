import connection, { IConnection } from './connection';
import InvitesStore from './InvitesStore';
import NotificationsStore from './NotificationsStore';
import SocialSyncsStore from './SocialSyncsStore';
import SubscribersStore from './SubscribersStore';
import UserConnectionsStore from './UserConnectionsStore';
import UsersStore from './UsersStore';
import VerificationCodesStore from './VerificationCodesStore';

class Store {
    db: IConnection;

    subscribers: SubscribersStore;

    socialSyncs: SocialSyncsStore;

    users: UsersStore;

    userConnections: UserConnectionsStore;

    invites: InvitesStore;

    notifications: NotificationsStore;

    verificationCodes: VerificationCodesStore;

    constructor(dbConnection) {
        this.db = dbConnection;

        this.users = new UsersStore(this.db);
        this.userConnections = new UserConnectionsStore(this.db);
        this.subscribers = new SubscribersStore(this.db);
        this.socialSyncs = new SocialSyncsStore(this.db);
        this.invites = new InvitesStore(this.db);
        this.notifications = new NotificationsStore(this.db);
        this.verificationCodes = new VerificationCodesStore(this.db);
    }
}

export default new Store(connection);
