// IMPORTANT: Developers should update version after making any changes to these configs. An achievement key/id should never be changed
// NOTE: title and description should be translated by the consumer of this config
// using translation keys (ex. explorer_1_1.title, explorer_1_1.description)

const communityLeaderAchievements = {
    communityLeader_1_1: {
        title: 'Community Starter',
        description: 'Get 3 signups from invite link',
        bonusAbilityId: '',
        prerequisite: (userAchievements: { [key: string]: any }) => true,
        countToComplete: 3,
        xp: 10,
        pointReward: 15.00,
        mediaId: 'community-starter',
        tier: '1_1',
        version: 1,
    },
    communityLeader_1_1_1: {
        title: 'Community Builder',
        description: 'Get 5 signups from invite link',
        bonusAbilityId: '',
        prerequisite: (userAchievements: { [key: string]: any }) => true,
        countToComplete: 5,
        xp: 20,
        pointReward: 20.00,
        mediaId: 'community-builder',
        tier: '1_1',
        version: 1,
    },
    communityLeader_1_1_2: {
        title: 'Community Developer',
        description: 'Get 10 signups from invite link',
        bonusAbilityId: '',
        prerequisite: (userAchievements: { [key: string]: any }) => true,
        countToComplete: 10,
        xp: 30,
        pointReward: 50.00,
        mediaId: 'community-developer',
        tier: '1_1',
        version: 1,
    },
};

export default communityLeaderAchievements;
