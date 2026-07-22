// IMPORTANT: Developers should update version after making any changes to these configs. An achievement key/id should never be changed
// NOTE: title and description should be translated by the consumer of this config
// using translation keys (ex. weeklyChampion_1_1.title, weeklyChampion_1_1.description)

// Leaderboard-performance achievements, awarded when a user's weekly XP crosses a
// rank milestone (top 10 / top 3 / #1) — see users-service
// handlers/helpers/leaderboardRankMilestones.ts. Enabled for every brand that has a
// leaderboard (Therr AND niche brands like HABITS), unlike the content-coupled classes.
const weeklyChampionAchievements = {
    weeklyChampion_1_1: {
        title: 'Contender',
        description: 'Reach the top 10 on the weekly leaderboard',
        bonusAbilityId: '',
        prerequisite: (userAchievements: { [key: string]: any }) => true,
        countToComplete: 1,
        xp: 25,
        pointReward: 0.25,
        mediaId: 'contender',
        tier: '1_1',
        version: 1,
    },
    weeklyChampion_1_1_1: {
        title: 'Regular Contender',
        description: 'Reach the weekly top 10 five more times',
        bonusAbilityId: '',
        prerequisite: (userAchievements: { [key: string]: any }) => true,
        countToComplete: 5,
        xp: 50,
        pointReward: 0.50,
        mediaId: 'regular-contender',
        tier: '1_1',
        version: 1,
    },
    weeklyChampion_1_2: {
        title: 'Podium Finish',
        description: 'Reach the top 3 on the weekly leaderboard',
        bonusAbilityId: '',
        prerequisite: (userAchievements: { [key: string]: any }) => true,
        countToComplete: 1,
        xp: 50,
        pointReward: 0.50,
        mediaId: 'podium-finish',
        tier: '1_2',
        version: 1,
    },
    weeklyChampion_1_2_1: {
        title: 'Podium Regular',
        description: 'Reach the weekly top 3 five more times',
        bonusAbilityId: '',
        prerequisite: (userAchievements: { [key: string]: any }) => true,
        countToComplete: 5,
        xp: 100,
        pointReward: 1.00,
        mediaId: 'podium-regular',
        tier: '1_2',
        version: 1,
    },
    weeklyChampion_1_3: {
        title: 'Number One',
        description: 'Reach #1 on the weekly leaderboard',
        bonusAbilityId: '',
        prerequisite: (userAchievements: { [key: string]: any }) => true,
        countToComplete: 1,
        xp: 100,
        pointReward: 1.00,
        mediaId: 'number-one',
        tier: '1_3',
        version: 1,
    },
    weeklyChampion_1_3_1: {
        title: 'Serial Champion',
        description: 'Reach #1 on the weekly leaderboard five more times',
        bonusAbilityId: '',
        prerequisite: (userAchievements: { [key: string]: any }) => true,
        countToComplete: 5,
        xp: 250,
        pointReward: 2.00,
        mediaId: 'serial-champion',
        tier: '1_3',
        version: 1,
    },
};

export default weeklyChampionAchievements;
