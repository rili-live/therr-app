// IMPORTANT: Developers should update version after making any changes to these configs. An achievement key/id should never be changed
// NOTE: title and description should be translated by the consumer of this config
// using translation keys (ex. explorer_1_1.title, explorer_1_1.description)

const thinkerAchievements = {
    thinker_1_1: {
        title: 'Thoughtful',
        description: 'Create 1 thought',
        bonusAbilityId: '',
        prerequisite: (userAchievements: { [key: string]: any }) => true,
        countToComplete: 1,
        xp: 5,
        pointReward: 0.10,
        mediaId: 'thoughtful',
        tier: '1_1',
        version: 1,
    },
    thinker_1_1_1: {
        title: 'Very Thoughtful',
        description: 'Create 3 thoughts',
        bonusAbilityId: '',
        prerequisite: (userAchievements: { [key: string]: any }) => !!userAchievements.thinker_1_1,
        countToComplete: 3,
        xp: 10,
        pointReward: 0.25,
        mediaId: 'very-thoughtful',
        tier: '1_1',
        version: 1,
    },
    thinker_1_2: {
        title: 'Wise',
        description: 'Get 5 replies to thoughts',
        bonusAbilityId: '',
        prerequisite: (userAchievements: { [key: string]: any }) => true,
        countToComplete: 5,
        xp: 20,
        pointReward: 0.50,
        mediaId: 'wise',
        tier: '1_2',
        version: 1,
    },
    thinker_1_2_1: {
        title: 'Very Wise',
        description: 'Get 20 replies to thoughts',
        bonusAbilityId: '',
        prerequisite: (userAchievements: { [key: string]: any }) => !!userAchievements.thinker_1_2,
        countToComplete: 20,
        xp: 30,
        pointReward: 0.50,
        mediaId: 'very-wise',
        tier: '1_2',
        version: 1,
    },
};

export default thinkerAchievements;
