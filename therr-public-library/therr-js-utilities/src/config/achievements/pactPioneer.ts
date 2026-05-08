// IMPORTANT: Developers should update version after making any changes to these configs. An achievement key/id should never be changed
// NOTE: title and description should be translated by the consumer of this config
// SCOPE: All habit goal types. Tier 1 = pacts created. Tier 2 = unique partners invited (viral mechanic).

const pactPioneerAchievements = {
    // Tier 1 — pacts created
    pactPioneer_1_1: {
        title: 'Pact Starter',
        description: 'Create your first pact',
        bonusAbilityId: '',
        prerequisite: (userAchievements: { [key: string]: any }) => true,
        countToComplete: 1,
        xp: 15,
        pointReward: 0.50,
        mediaId: 'pact-starter',
        tier: '1_1',
        version: 1,
    },
    pactPioneer_1_1_1: {
        title: 'Pact Maker',
        description: 'Create 5 pacts',
        bonusAbilityId: '',
        prerequisite: (userAchievements: { [key: string]: any }) => !!userAchievements.pactPioneer_1_1,
        countToComplete: 5,
        xp: 50,
        pointReward: 1.50,
        mediaId: 'pact-maker',
        tier: '1_1',
        version: 1,
    },
    pactPioneer_1_1_2: {
        title: 'Pact Architect',
        description: 'Create 25 pacts',
        bonusAbilityId: '',
        prerequisite: (userAchievements: { [key: string]: any }) => !!userAchievements.pactPioneer_1_1_1,
        countToComplete: 25,
        xp: 200,
        pointReward: 6.00,
        mediaId: 'pact-architect',
        tier: '1_1',
        version: 1,
    },
    pactPioneer_1_1_3: {
        title: 'Pact Visionary',
        description: 'Create 100 pacts',
        bonusAbilityId: '',
        prerequisite: (userAchievements: { [key: string]: any }) => !!userAchievements.pactPioneer_1_1_2,
        countToComplete: 100,
        xp: 500,
        pointReward: 20.00,
        mediaId: 'pact-visionary',
        tier: '1_1',
        version: 1,
    },

    // Tier 2 — unique partners invited (viral)
    pactPioneer_1_2: {
        title: 'First Invite Sent',
        description: 'Invite your first unique partner',
        bonusAbilityId: '',
        prerequisite: (userAchievements: { [key: string]: any }) => true,
        countToComplete: 1,
        xp: 15,
        pointReward: 0.50,
        mediaId: 'first-invite-sent',
        tier: '1_2',
        version: 1,
    },
    pactPioneer_1_2_1: {
        title: 'Network Effect',
        description: 'Invite 10 unique partners across pacts',
        bonusAbilityId: '',
        prerequisite: (userAchievements: { [key: string]: any }) => !!userAchievements.pactPioneer_1_2,
        countToComplete: 10,
        xp: 150,
        pointReward: 5.00,
        mediaId: 'network-effect',
        tier: '1_2',
        version: 1,
    },
};

export default pactPioneerAchievements;
