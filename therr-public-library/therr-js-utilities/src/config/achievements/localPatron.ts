// IMPORTANT: Developers should update version after making any changes to these configs. An achievement key/id should never be changed
// NOTE: title and description should be translated by the consumer of this config
// using translation keys (ex. localPatron_1_1.title, localPatron_1_1.description)
// These achievements are awarded when a Plaid-verified purchase is made at a Therr-enrolled business.
// Progress count = total verified purchases across all enrolled businesses.

const localPatronAchievements = {
    localPatron_1_1: {
        title: 'Local Supporter',
        description: 'Make 1 verified purchase at a Therr business',
        bonusAbilityId: '',
        prerequisite: (userAchievements: { [key: string]: any }) => true,
        countToComplete: 1,
        xp: 10,
        pointReward: 5.00,
        mediaId: 'local-supporter',
        tier: '1_1',
        version: 1,
    },
    localPatron_1_1_1: {
        title: 'Neighborhood Regular',
        description: 'Make 5 verified purchases at Therr businesses',
        bonusAbilityId: '',
        prerequisite: (userAchievements: { [key: string]: any }) => !!userAchievements.localPatron_1_1,
        countToComplete: 5,
        xp: 20,
        pointReward: 10.00,
        mediaId: 'neighborhood-regular',
        tier: '1_1',
        version: 1,
    },
    localPatron_1_1_2: {
        title: 'Community Champion',
        description: 'Make 10 verified purchases at Therr businesses',
        bonusAbilityId: '',
        prerequisite: (userAchievements: { [key: string]: any }) => !!userAchievements.localPatron_1_1_1,
        countToComplete: 10,
        xp: 30,
        pointReward: 20.00,
        mediaId: 'community-champion',
        tier: '1_1',
        version: 1,
    },
    localPatron_1_1_3: {
        title: 'Local Hero',
        description: 'Make 25 verified purchases at Therr businesses',
        bonusAbilityId: '',
        prerequisite: (userAchievements: { [key: string]: any }) => !!userAchievements.localPatron_1_1_2,
        countToComplete: 25,
        xp: 50,
        pointReward: 50.00,
        mediaId: 'local-hero',
        tier: '1_1',
        version: 1,
    },
    localPatron_1_1_4: {
        title: 'Pillar of the Community',
        description: 'Make 50 verified purchases at Therr businesses',
        bonusAbilityId: '',
        prerequisite: (userAchievements: { [key: string]: any }) => !!userAchievements.localPatron_1_1_3,
        countToComplete: 50,
        xp: 100,
        pointReward: 100.00,
        mediaId: 'pillar-of-the-community',
        tier: '1_1',
        version: 1,
    },
};

export default localPatronAchievements;
