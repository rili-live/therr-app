import { IPostType } from '../../types';

export enum Types {
    // Event Driven
    achievementCompleted = 'achievement-completed',
    connectionRequestAccepted = 'connection-request-accepted',
    newConnectionRequest = 'new-connection-request',
    newDirectMessage = 'new-direct-message',
    newGroupInvite = 'new-group-invite',
    newGroupMessage = 'new-group-message',
    newGroupMembers = 'new-group-members',
    newLikeReceived = 'new-like-received',
    newSuperLikeReceived = 'new-super-like-received',
    newAreasActivated = 'new-moments-activated',
    nudgeSpaceEngagement = 'nudge-space-engagement',
    proximityRequiredMoment = 'proximity-required-moment',
    proximityRequiredSpace = 'proximity-required-space',
    newThoughtReplyReceived = 'new-thought-reply-received',

    // Automation
    createYourProfileReminder = 'create-your-profile-reminder',
    createAMomentReminder = 'create-a-moment-reminder',
    latestPostLikesStats = 'latest-post-likes-stats',
    latestPostViewcountStats = 'latest-post-viewcount-stats',
    unreadNotificationsReminder = 'unread-notifications-reminder',
    unclaimedAchievementsReminder = 'unclaimed-achievements-reminder',
}

export enum PressActionIds {
    default = 'default',
    discovered = 'discovered',
    drafts = 'drafts',
    exchange = 'exchange-coins',
    markAsRead = 'mark-as-read',
    momentView = 'view-moment',
    nudge = 'nudge',
    dmView = 'view-dm',
    dmReplyToMsg = 'reply-to-dm-msg',
    groupView = 'view-group',
    groupReplyToMsg = 'reply-to-group-msg',
    thoughtView = 'view-thought',
    spaceView = 'view-space',
    userView = 'view-user',
    userAcceptConnectionRequest = 'accept-user-connection-request'
}

export type IntentActionKey = 'ACHIEVEMENT_COMPLETED'
| 'CREATE_YOUR_PROFILE_REMINDER'
| 'CREATE_A_MOMENT_REMINDER'
| 'LATEST_POST_LIKES_STATS'
| 'LATEST_POST_VIEWCOUNT_STATS'
| 'NEW_AREAS_ACTIVATED'
| 'NUDGE_SPACE_ENGAGEMENT'
| 'NEW_CONNECTION'
| 'NEW_CONNECTION_REQUEST'
| 'NEW_DIRECT_MESSAGE'
| 'NEW_GROUP_MESSAGE'
| 'NEW_GROUP_INVITE'
| 'NEW_GROUP_MEMBERS'
| 'NEW_LIKE_RECEIVED'
| 'NEW_THOUGHT_REPLY_RECEIVED'
| 'NEW_SUPER_LIKE_RECEIVED'
| 'UNREAD_NOTIFICATIONS_REMINDER'
| 'UNCLAIMED_ACHIEVEMENTS_REMINDER';

enum TeemAndroidIntentActions {
    ACHIEVEMENT_COMPLETED = 'com.therr.mobile.ACHIEVEMENT_COMPLETED',
    CREATE_YOUR_PROFILE_REMINDER = 'com.therr.mobile.CREATE_YOUR_PROFILE_REMINDER',
    CREATE_A_MOMENT_REMINDER = 'com.therr.mobile.CREATE_A_MOMENT_REMINDER',
    LATEST_POST_LIKES_STATS = 'com.therr.mobile.LATEST_POST_LIKES_STATS',
    LATEST_POST_VIEWCOUNT_STATS = 'com.therr.mobile.LATEST_POST_VIEWCOUNT_STATS',
    NEW_AREAS_ACTIVATED = 'com.therr.mobile.NEW_AREAS_ACTIVATED',
    NUDGE_SPACE_ENGAGEMENT = 'com.therr.mobile.NUDGE_SPACE_ENGAGEMENT',
    NEW_CONNECTION = 'com.therr.mobile.NEW_CONNECTION',
    NEW_CONNECTION_REQUEST = 'com.therr.mobile.NEW_CONNECTION_REQUEST',
    NEW_DIRECT_MESSAGE = 'com.therr.mobile.NEW_DIRECT_MESSAGE',
    NEW_GROUP_MESSAGE = 'com.therr.mobile.NEW_GROUP_MESSAGE',
    NEW_GROUP_INVITE = 'com.therr.mobile.NEW_GROUP_INVITE',
    NEW_GROUP_MEMBERS = 'com.therr.mobile.NEW_GROUP_MEMBERS',
    NEW_LIKE_RECEIVED = 'com.therr.mobile.NEW_LIKE_RECEIVED',
    NEW_THOUGHT_REPLY_RECEIVED = 'com.therr.mobile.NEW_THOUGHT_REPLY_RECEIVED',
    NEW_SUPER_LIKE_RECEIVED = 'com.therr.mobile.NEW_SUPER_LIKE_RECEIVED',
    UNREAD_NOTIFICATIONS_REMINDER = 'com.therr.mobile.UNREAD_NOTIFICATIONS_REMINDER',
    UNCLAIMED_ACHIEVEMENTS_REMINDER = 'com.therr.mobile.UNCLAIMED_ACHIEVEMENTS_REMINDER',
}

enum TherrAndroidIntentActions {
    ACHIEVEMENT_COMPLETED = 'app.therrmobile.ACHIEVEMENT_COMPLETED',
    CREATE_YOUR_PROFILE_REMINDER = 'app.therrmobile.CREATE_YOUR_PROFILE_REMINDER',
    CREATE_A_MOMENT_REMINDER = 'app.therrmobile.CREATE_A_MOMENT_REMINDER',
    LATEST_POST_LIKES_STATS = 'app.therrmobile.LATEST_POST_LIKES_STATS',
    LATEST_POST_VIEWCOUNT_STATS = 'app.therrmobile.LATEST_POST_VIEWCOUNT_STATS',
    NEW_AREAS_ACTIVATED = 'app.therrmobile.NEW_AREAS_ACTIVATED',
    NUDGE_SPACE_ENGAGEMENT = 'app.therrmobile.NUDGE_SPACE_ENGAGEMENT',
    NEW_CONNECTION = 'app.therrmobile.NEW_CONNECTION',
    NEW_CONNECTION_REQUEST = 'app.therrmobile.NEW_CONNECTION_REQUEST',
    NEW_DIRECT_MESSAGE = 'app.therrmobile.NEW_DIRECT_MESSAGE',
    NEW_GROUP_MESSAGE = 'app.therrmobile.NEW_GROUP_MESSAGE',
    NEW_GROUP_INVITE = 'app.therrmobile.NEW_GROUP_INVITE',
    NEW_GROUP_MEMBERS = 'app.therrmobile.NEW_GROUP_MEMBERS',
    NEW_LIKE_RECEIVED = 'app.therrmobile.NEW_LIKE_RECEIVED',
    NEW_THOUGHT_REPLY_RECEIVED = 'app.therrmobile.NEW_THOUGHT_REPLY_RECEIVED',
    NEW_SUPER_LIKE_RECEIVED = 'app.therrmobile.NEW_SUPER_LIKE_RECEIVED',
    UNREAD_NOTIFICATIONS_REMINDER = 'app.therrmobile.UNREAD_NOTIFICATIONS_REMINDER',
    UNCLAIMED_ACHIEVEMENTS_REMINDER = 'app.therrmobile.UNCLAIMED_ACHIEVEMENTS_REMINDER',
}

export interface INotificationData {
    associationId?: string;
    areasActivated?: { spaceId?: string }[];
    area?: {
        id: string;
        fromUserId?: string;
    },
    fromUser?: {
        id: string;
        userName: string;
        name?: string;
    };
    fromUserDetails?: any;
    groupDetails?: any;
    groupId?: string;
    groupName?: string;
    notificationData?: { [key: string]: any }; // Data for the app notification / redux state
    postType?: IPostType,
    thought?: {
        id: string;
        fromUserId?: string;
    };
}

export const AndroidIntentActions = {
    Teem: TeemAndroidIntentActions,
    Therr: TherrAndroidIntentActions,
};
