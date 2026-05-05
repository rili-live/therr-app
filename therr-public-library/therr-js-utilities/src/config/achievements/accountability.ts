// IMPORTANT: Developers should update version after making any changes to these configs. An achievement key/id should never be changed
// NOTE: title and description should be translated by the consumer of this config
// SCOPE: Awarded for pact participation across all goal types. Tier 1 = self completion at >=80%.
// Tier 2 = "wing person" — partner-side credit for helping someone else hit their pact.

const accountabilityAchievements = {
    // Tier 1 — self pact completion
    accountability_1_1: {
        title: 'First Pact',
        description: 'Join your first pact',
        bonusAbilityId: '',
        prerequisite: (userAchievements: { [key: string]: any }) => true,
        countToComplete: 1,
        xp: 15,
        pointReward: 0.50,
        mediaId: 'first-pact',
        tier: '1_1',
        version: 1,
    },
    accountability_1_1_1: {
        title: 'Loyal Partner',
        description: 'Complete a pact at 80% or higher',
        bonusAbilityId: '',
        prerequisite: (userAchievements: { [key: string]: any }) => !!userAchievements.accountability_1_1,
        countToComplete: 1,
        xp: 50,
        pointReward: 2.00,
        mediaId: 'loyal-partner',
        tier: '1_1',
        version: 1,
    },
    accountability_1_1_2: {
        title: 'Reliable Ally',
        description: 'Complete 5 pacts at 80% or higher',
        bonusAbilityId: '',
        prerequisite: (userAchievements: { [key: string]: any }) => !!userAchievements.accountability_1_1_1,
        countToComplete: 5,
        xp: 150,
        pointReward: 6.00,
        mediaId: 'reliable-ally',
        tier: '1_1',
        version: 1,
    },
    accountability_1_1_3: {
        title: 'Habit Champion',
        description: 'Complete 25 pacts at 80% or higher',
        bonusAbilityId: '',
        prerequisite: (userAchievements: { [key: string]: any }) => !!userAchievements.accountability_1_1_2,
        countToComplete: 25,
        xp: 500,
        pointReward: 20.00,
        mediaId: 'habit-champion',
        tier: '1_1',
        version: 1,
    },

    // Tier 2 — wing person (partner credit)
    accountability_1_2: {
        title: 'Wing Person',
        description: 'Help a partner complete their pact at 80% or higher',
        bonusAbilityId: '',
        prerequisite: (userAchievements: { [key: string]: any }) => true,
        countToComplete: 1,
        xp: 25,
        pointReward: 1.00,
        mediaId: 'wing-person',
        tier: '1_2',
        version: 1,
    },
    accountability_1_2_1: {
        title: 'Coach',
        description: 'Help 5 partners complete their pacts at 80% or higher',
        bonusAbilityId: '',
        prerequisite: (userAchievements: { [key: string]: any }) => !!userAchievements.accountability_1_2,
        countToComplete: 5,
        xp: 100,
        pointReward: 4.00,
        mediaId: 'coach',
        tier: '1_2',
        version: 1,
    },
    accountability_1_2_2: {
        title: 'Mentor',
        description: 'Help 25 partners complete their pacts at 80% or higher',
        bonusAbilityId: '',
        prerequisite: (userAchievements: { [key: string]: any }) => !!userAchievements.accountability_1_2_1,
        countToComplete: 25,
        xp: 400,
        pointReward: 15.00,
        mediaId: 'mentor',
        tier: '1_2',
        version: 1,
    },
};

export default accountabilityAchievements;
