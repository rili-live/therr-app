import connection, { IConnection } from './connection';
import ApiKeysStore from './ApiKeysStore';
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
import NotificationQueueStore from './NotificationQueueStore';
import ThoughtsStore from './ThoughtsStore';
import UserAcquisitionStore from './UserAcquisitionStore';
import UserAchievementsStore from './UserAchievementsStore';
import UserConnectionsStore from './UserConnectionsStore';
import UserLeaderboardScoresStore from './UserLeaderboardScoresStore';
import UserDeviceTokensStore from './UserDeviceTokensStore';
import UserInterestsStore from './UserInterestsStore';
import UserMetricsStore from './UserMetricsStore';
import UserLocationsStore from './UserLocationsStore';
import UserOrganizationsStore from './UserOrganizationsStore';
import UserGroupsStore from './UserGroupsStore';
import UsersStore from './UsersStore';
import VerificationCodesStore from './VerificationCodesStore';
// HABITS stores
import HabitGoalsStore from './HabitGoalsStore';
import PactsStore from './PactsStore';
import PactMembersStore from './PactMembersStore';
import HabitCheckinsStore from './HabitCheckinsStore';
import StreaksStore from './StreaksStore';
import HabitPhasesStore from './HabitPhasesStore';
import ProofsStore from './ProofsStore';
import PactActivitiesStore from './PactActivitiesStore';
import UserHabitsStore from './UserHabitsStore';
import LifetimePurchasesStore from './LifetimePurchasesStore';
import JournalEntriesStore from './JournalEntriesStore';

class Store {
    db: IConnection;

    apiKeys: ApiKeysStore;

    blacklistedEmails: BlacklistedEmailsStore;

    campaigns: CampaignsStore;

    campaignAdGroups: CampaignAdGroupsStore;

    campaignAssets: CampaignAssetsStore;

    config: ConfigStore;

    subscribers: SubscribersStore;

    socialSyncs: SocialSyncsStore;

    thoughts: ThoughtsStore;

    users: UsersStore;

    userAcquisition: UserAcquisitionStore;

    userAchievements: UserAchievementsStore;

    notificationQueue: NotificationQueueStore;

    userConnections: UserConnectionsStore;

    userLeaderboardScores: UserLeaderboardScoresStore;

    userDeviceTokens: UserDeviceTokensStore;

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

    // HABITS stores
    habitGoals: HabitGoalsStore;

    pacts: PactsStore;

    pactMembers: PactMembersStore;

    habitCheckins: HabitCheckinsStore;

    streaks: StreaksStore;

    habitPhases: HabitPhasesStore;

    proofs: ProofsStore;

    pactActivities: PactActivitiesStore;

    userHabits: UserHabitsStore;

    lifetimePurchases: LifetimePurchasesStore;

    journalEntries: JournalEntriesStore;

    constructor(dbConnection) {
        this.db = dbConnection;

        this.apiKeys = new ApiKeysStore(this.db);
        this.blacklistedEmails = new BlacklistedEmailsStore(this.db);
        this.campaigns = new CampaignsStore(this.db);
        this.campaignAdGroups = new CampaignAdGroupsStore(this.db);
        this.campaignAssets = new CampaignAssetsStore(this.db);
        this.config = new ConfigStore(this.db);
        this.users = new UsersStore(this.db);
        this.userAcquisition = new UserAcquisitionStore(this.db);
        this.userAchievements = new UserAchievementsStore(this.db);
        this.notificationQueue = new NotificationQueueStore(this.db);
        this.userConnections = new UserConnectionsStore(this.db);
        this.userLeaderboardScores = new UserLeaderboardScoresStore(this.db);
        this.userDeviceTokens = new UserDeviceTokensStore(this.db);
        this.userInterests = new UserInterestsStore(this.db);
        this.userMetrics = new UserMetricsStore(this.db);
        this.userLocations = new UserLocationsStore(this.db);
        this.userOrganizations = new UserOrganizationsStore(this.db);
        this.userGroups = new UserGroupsStore(this.db);
        this.subscribers = new SubscribersStore(this.db);
        this.socialSyncs = new SocialSyncsStore(this.db);
        // userLocations is passed so `create` can check an author is near the city their post
        // names before tagging it (see ThoughtsStore.getAuthorLocation). Must stay constructed
        // after `this.userLocations` above.
        this.thoughts = new ThoughtsStore(this.db, this.users, this.userLocations);
        this.interests = new InterestsStore(this.db);
        this.invites = new InvitesStore(this.db);
        this.inviteCodes = new InviteCodesStore(this.db);
        this.notifications = new NotificationsStore(this.db);
        this.organizations = new OrganizationsStore(this.db);
        this.verificationCodes = new VerificationCodesStore(this.db);

        // HABITS stores
        this.habitGoals = new HabitGoalsStore(this.db);
        this.pacts = new PactsStore(this.db);
        this.pactMembers = new PactMembersStore(this.db);
        this.habitCheckins = new HabitCheckinsStore(this.db);
        this.streaks = new StreaksStore(this.db);
        this.habitPhases = new HabitPhasesStore(this.db);
        this.proofs = new ProofsStore(this.db);
        this.pactActivities = new PactActivitiesStore(this.db);
        this.userHabits = new UserHabitsStore(this.db);
        this.lifetimePurchases = new LifetimePurchasesStore(this.db);
        this.journalEntries = new JournalEntriesStore(this.db);
    }
}

export default new Store(connection);
