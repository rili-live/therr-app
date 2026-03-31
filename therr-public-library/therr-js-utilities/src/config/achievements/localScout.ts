// IMPORTANT: Developers should update version after making any changes to these configs. An achievement key/id should never be changed
// NOTE: title and description should be translated by the consumer of this config
// using translation keys (ex. localScout_1_1.title, localScout_1_1.description)

const localScoutAchievements = {
    localScout_1_1: {
        title: 'First Report',
        description: 'Submit 1 Quick Report',
        bonusAbilityId: '',
        prerequisite: (userAchievements: { [key: string]: any }) => true,
        countToComplete: 1,
        xp: 5,
        pointReward: 0.25,
        mediaId: 'first-report',
        tier: '1_1',
        version: 1,
    },
    localScout_1_1_1: {
        title: 'Local Scout',
        description: 'Submit 5 Quick Reports',
        bonusAbilityId: '',
        prerequisite: (userAchievements: { [key: string]: any }) => !!userAchievements.localScout_1_1,
        countToComplete: 5,
        xp: 10,
        pointReward: 0.50,
        mediaId: 'local-scout',
        tier: '1_1',
        version: 1,
    },
    localScout_1_1_2: {
        title: 'Neighborhood Watch',
        description: 'Submit 25 Quick Reports',
        bonusAbilityId: '',
        prerequisite: (userAchievements: { [key: string]: any }) => !!userAchievements.localScout_1_1_1,
        countToComplete: 25,
        xp: 25,
        pointReward: 1.00,
        mediaId: 'neighborhood-watch',
        tier: '1_1',
        version: 1,
    },
    localScout_1_1_3: {
        title: 'Community Reporter',
        description: 'Submit 100 Quick Reports',
        bonusAbilityId: '',
        prerequisite: (userAchievements: { [key: string]: any }) => !!userAchievements.localScout_1_1_2,
        countToComplete: 100,
        xp: 50,
        pointReward: 2.00,
        mediaId: 'community-reporter',
        tier: '1_1',
        version: 1,
    },
    localScout_1_1_4: {
        title: 'Local Legend',
        description: 'Submit 500 Quick Reports',
        bonusAbilityId: '',
        prerequisite: (userAchievements: { [key: string]: any }) => !!userAchievements.localScout_1_1_3,
        countToComplete: 500,
        xp: 100,
        pointReward: 3.00,
        mediaId: 'local-legend',
        tier: '1_1',
        version: 1,
    },
};

export default localScoutAchievements;
