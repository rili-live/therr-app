import connection, { IConnection } from './connection';
import BlacklistedEmailsStore from './BlacklistedEmailsStore';
import CampaignsStore from './CampaignsStore';
import CampaignAdGroupsStore from './CampaignAdGroupsStore';
import CampaignAssetsStore from './CampaignAssetsStore';
import ConfigStore from './ConfigStore';
import InterestsStore from './InterestsStore';
import InvitesStore from './InvitesStore';
import InviteCodesStore from './InviteCodesStore';
import NotificationsStore from './NotificationsStore';
import OrganizationsStore from './OrganizationsStore';
import SocialSyncsStore from './SocialSyncsStore';
import SubscribersStore from './SubscribersStore';
import ThoughtsStore from './ThoughtsStore';
import UserAchievementsStore from './UserAchievementsStore';
import UserConnectionsStore from './UserConnectionsStore';
import UserInterestsStore from './UserInterestsStore';
import UserMetricsStore from './UserMetricsStore';
import UserLocationsStore from './UserLocationsStore';
import UserOrganizationsStore from './UserOrganizationsStore';
import UserGroupsStore from './UserGroupsStore';
import UsersStore from './UsersStore';
import VerificationCodesStore from './VerificationCodesStore';

class Store {
    db: IConnection;

    blacklistedEmails: BlacklistedEmailsStore;

    campaigns: CampaignsStore;

    campaignAdGroups: CampaignAdGroupsStore;

    campaignAssets: CampaignAssetsStore;

    config: ConfigStore;

    subscribers: SubscribersStore;

    socialSyncs: SocialSyncsStore;

    thoughts: ThoughtsStore;

    users: UsersStore;

    userAchievements: UserAchievementsStore;

    userConnections: UserConnectionsStore;

    userInterests: UserInterestsStore;

    userMetrics: UserMetricsStore;

    userLocations: UserLocationsStore;

    userOrganizations: UserOrganizationsStore;

    userGroups: UserGroupsStore;

    interests: InterestsStore;

    invites: InvitesStore;

    inviteCodes: InviteCodesStore;

    notifications: NotificationsStore;

    organizations: OrganizationsStore;

    verificationCodes: VerificationCodesStore;

    constructor(dbConnection) {
        this.db = dbConnection;

        this.blacklistedEmails = new BlacklistedEmailsStore(this.db);
        this.campaigns = new CampaignsStore(this.db);
        this.campaignAdGroups = new CampaignAdGroupsStore(this.db);
        this.campaignAssets = new CampaignAssetsStore(this.db);
        this.config = new ConfigStore(this.db);
        this.users = new UsersStore(this.db);
        this.userAchievements = new UserAchievementsStore(this.db);
        this.userConnections = new UserConnectionsStore(this.db);
        this.userInterests = new UserInterestsStore(this.db);
        this.userMetrics = new UserMetricsStore(this.db);
        this.userLocations = new UserLocationsStore(this.db);
        this.userOrganizations = new UserOrganizationsStore(this.db);
        this.userGroups = new UserGroupsStore(this.db);
        this.subscribers = new SubscribersStore(this.db);
        this.socialSyncs = new SocialSyncsStore(this.db);
        this.thoughts = new ThoughtsStore(this.db, this.users);
        this.interests = new InterestsStore(this.db);
        this.invites = new InvitesStore(this.db);
        this.inviteCodes = new InviteCodesStore(this.db);
        this.notifications = new NotificationsStore(this.db);
        this.organizations = new OrganizationsStore(this.db);
        this.verificationCodes = new VerificationCodesStore(this.db);
    }
}

export default new Store(connection);
