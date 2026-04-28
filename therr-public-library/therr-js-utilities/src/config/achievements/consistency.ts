// IMPORTANT: Developers should update version after making any changes to these configs. An achievement key/id should never be changed
// NOTE: title and description should be translated by the consumer of this config
// SCOPE: All habit goal types. Tier 1 = perfect single-habit periods (zero misses on scheduled days).
// Tier 2 = perfect periods across multiple habits simultaneously.

const consistencyAchievements = {
    // Tier 1 — single habit, zero misses on scheduled days
    consistency_1_1: {
        title: 'Perfect Week',
        description: 'Complete every scheduled check-in for 7 days on one habit',
        bonusAbilityId: '',
        prerequisite: (userAchievements: { [key: string]: any }) => true,
        countToComplete: 7,
        xp: 20,
        pointReward: 0.50,
        mediaId: 'perfect-week',
        tier: '1_1',
        version: 1,
    },
    consistency_1_1_1: {
        title: 'Flawless Fortnight',
        description: 'Complete every scheduled check-in for 14 days on one habit',
        bonusAbilityId: '',
        prerequisite: (userAchievements: { [key: string]: any }) => !!userAchievements.consistency_1_1,
        countToComplete: 14,
        xp: 40,
        pointReward: 1.00,
        mediaId: 'flawless-fortnight',
        tier: '1_1',
        version: 1,
    },
    consistency_1_1_2: {
        title: 'Spotless Month',
        description: 'Complete every scheduled check-in for 30 days on one habit',
        bonusAbilityId: '',
        prerequisite: (userAchievements: { [key: string]: any }) => !!userAchievements.consistency_1_1_1,
        countToComplete: 30,
        xp: 80,
        pointReward: 2.50,
        mediaId: 'spotless-month',
        tier: '1_1',
        version: 1,
    },
    consistency_1_1_3: {
        title: 'Pristine Quarter',
        description: 'Complete every scheduled check-in for 90 days on one habit',
        bonusAbilityId: '',
        prerequisite: (userAchievements: { [key: string]: any }) => !!userAchievements.consistency_1_1_2,
        countToComplete: 90,
        xp: 200,
        pointReward: 7.00,
        mediaId: 'pristine-quarter',
        tier: '1_1',
        version: 1,
    },

    // Tier 2 — multiple habits maintained simultaneously over a perfect period
    consistency_1_2: {
        title: 'Two At Once',
        description: 'Complete a perfect 7-day window on 2 habits simultaneously',
        bonusAbilityId: '',
        prerequisite: (userAchievements: { [key: string]: any }) => true,
        countToComplete: 2,
        xp: 30,
        pointReward: 1.00,
        mediaId: 'two-at-once',
        tier: '1_2',
        version: 1,
    },
    consistency_1_2_1: {
        title: 'Triple Threat',
        description: 'Complete a perfect 7-day window on 3 habits simultaneously',
        bonusAbilityId: '',
        prerequisite: (userAchievements: { [key: string]: any }) => !!userAchievements.consistency_1_2,
        countToComplete: 3,
        xp: 60,
        pointReward: 2.50,
        mediaId: 'triple-threat',
        tier: '1_2',
        version: 1,
    },
    consistency_1_2_2: {
        title: 'All Things at Once',
        description: 'Complete a perfect 7-day window on 5 habits simultaneously',
        bonusAbilityId: '',
        prerequisite: (userAchievements: { [key: string]: any }) => !!userAchievements.consistency_1_2_1,
        countToComplete: 5,
        xp: 120,
        pointReward: 5.00,
        mediaId: 'all-things-at-once',
        tier: '1_2',
        version: 1,
    },
};

export default consistencyAchievements;
