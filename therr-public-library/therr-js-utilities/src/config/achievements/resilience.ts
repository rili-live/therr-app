// IMPORTANT: Developers should update version after making any changes to these configs. An achievement key/id should never be changed
// NOTE: title and description should be translated by the consumer of this config
// SCOPE: All habit goal types. Tier 1 = comeback streaks (restart after a break). Tier 2 = within-pact recovery.

const resilienceAchievements = {
    // Tier 1 — comeback after streak resets
    resilience_1_1: {
        title: 'Bounce Back',
        description: 'Restart a streak after a previous one ended',
        bonusAbilityId: '',
        prerequisite: (userAchievements: { [key: string]: any }) => true,
        countToComplete: 1,
        xp: 15,
        pointReward: 0.50,
        mediaId: 'bounce-back',
        tier: '1_1',
        version: 1,
    },
    resilience_1_1_1: {
        title: 'Phoenix',
        description: 'Beat your previous longest streak after a reset',
        bonusAbilityId: '',
        prerequisite: (userAchievements: { [key: string]: any }) => !!userAchievements.resilience_1_1,
        countToComplete: 1,
        xp: 75,
        pointReward: 3.00,
        mediaId: 'phoenix',
        tier: '1_1',
        version: 1,
    },
    resilience_1_1_2: {
        title: 'Unbreakable',
        description: 'Beat your previous longest streak 5 times',
        bonusAbilityId: '',
        prerequisite: (userAchievements: { [key: string]: any }) => !!userAchievements.resilience_1_1_1,
        countToComplete: 5,
        xp: 200,
        pointReward: 8.00,
        mediaId: 'unbreakable',
        tier: '1_1',
        version: 1,
    },

    // Tier 2 — within-pact recovery (finished a pact strong despite mid-pact resets)
    resilience_1_2: {
        title: 'Second Wind',
        description: 'Finish a pact strong after losing your streak mid-pact',
        bonusAbilityId: '',
        prerequisite: (userAchievements: { [key: string]: any }) => true,
        countToComplete: 1,
        xp: 30,
        pointReward: 1.00,
        mediaId: 'second-wind',
        tier: '1_2',
        version: 1,
    },
    resilience_1_2_1: {
        title: 'Comeback Kid',
        description: 'Finish 5 pacts strong after losing your streak mid-pact',
        bonusAbilityId: '',
        prerequisite: (userAchievements: { [key: string]: any }) => !!userAchievements.resilience_1_2,
        countToComplete: 5,
        xp: 150,
        pointReward: 5.00,
        mediaId: 'comeback-kid',
        tier: '1_2',
        version: 1,
    },
};

export default resilienceAchievements;
