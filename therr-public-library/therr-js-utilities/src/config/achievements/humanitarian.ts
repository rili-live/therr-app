// IMPORTANT: Developers should update version after making any changes to these configs. An achievement key/id should never be changed
// NOTE: title and description should be translated by the consumer of this config
// using translation keys (ex. explorer_1_1.title, explorer_1_1.description)

const humanitarianAchievements = {
    humanitarian_1_1: {
        title: '',
        description: '',
        bonusAbilityId: '',
        prerequisite: (userAchievements: { [key: string]: any }) => true,
        countToComplete: 0,
        xp: 1,
        pointReward: 1.00,
        mediaId: '',
        version: 1,
    },
};

export default humanitarianAchievements;
