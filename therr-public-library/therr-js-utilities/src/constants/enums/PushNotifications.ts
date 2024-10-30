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
    nudge = 'nudge'
}
