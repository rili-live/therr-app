import connection, { IConnection } from './connection';
import BlacklistedEmailsStore from './BlacklistedEmailsStore';
import CampaignsStore from './CampaignsStore';
import ConfigStore from './ConfigStore';
import InvitesStore from './InvitesStore';
import NotificationsStore from './NotificationsStore';
import SocialSyncsStore from './SocialSyncsStore';
import SubscribersStore from './SubscribersStore';
import ThoughtsStore from './ThoughtsStore';
import UserAchievementsStore from './UserAchievementsStore';
import UserConnectionsStore from './UserConnectionsStore';
import UserMetricsStore from './UserMetricsStore';
import UserOrganizationsStore from './UserOrganizationsStore';
import UsersStore from './UsersStore';
import VerificationCodesStore from './VerificationCodesStore';

class Store {
    db: IConnection;

    blacklistedEmails: BlacklistedEmailsStore;

    campaigns: CampaignsStore;

    config: ConfigStore;

    subscribers: SubscribersStore;

    socialSyncs: SocialSyncsStore;

    thoughts: ThoughtsStore;

    users: UsersStore;

    userAchievements: UserAchievementsStore;

    userConnections: UserConnectionsStore;

    userMetrics: UserMetricsStore;

    userOrganizations: UserOrganizationsStore;

    invites: InvitesStore;

    notifications: NotificationsStore;

    verificationCodes: VerificationCodesStore;

    constructor(dbConnection) {
        this.db = dbConnection;

        this.blacklistedEmails = new BlacklistedEmailsStore(this.db);
        this.campaigns = new CampaignsStore(this.db);
        this.config = new ConfigStore(this.db);
        this.users = new UsersStore(this.db);
        this.userAchievements = new UserAchievementsStore(this.db);
        this.userConnections = new UserConnectionsStore(this.db);
        this.userMetrics = new UserMetricsStore(this.db);
        this.userOrganizations = new UserOrganizationsStore(this.db);
        this.subscribers = new SubscribersStore(this.db);
        this.socialSyncs = new SocialSyncsStore(this.db);
        this.thoughts = new ThoughtsStore(this.db, this.users);
        this.invites = new InvitesStore(this.db);
        this.notifications = new NotificationsStore(this.db);
        this.verificationCodes = new VerificationCodesStore(this.db);
    }
}

export default new Store(connection);
