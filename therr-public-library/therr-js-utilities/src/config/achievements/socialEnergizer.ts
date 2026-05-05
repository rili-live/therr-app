// IMPORTANT: Developers should update version after making any changes to these configs. An achievement key/id should never be changed
// NOTE: title and description should be translated by the consumer of this config
// SCOPE: All habit goal types. Tier 1 = reactions on partner check-ins. Tier 2 = celebrating partner milestones.

const socialEnergizerAchievements = {
    // Tier 1 — reactions on partner check-ins
    socialEnergizer_1_1: {
        title: 'Cheerleader',
        description: 'React to 10 partner check-ins',
        bonusAbilityId: '',
        prerequisite: (userAchievements: { [key: string]: any }) => true,
        countToComplete: 10,
        xp: 20,
        pointReward: 0.50,
        mediaId: 'cheerleader',
        tier: '1_1',
        version: 1,
    },
    socialEnergizer_1_1_1: {
        title: 'Hype Squad',
        description: 'React to 50 partner check-ins',
        bonusAbilityId: '',
        prerequisite: (userAchievements: { [key: string]: any }) => !!userAchievements.socialEnergizer_1_1,
        countToComplete: 50,
        xp: 60,
        pointReward: 2.00,
        mediaId: 'hype-squad',
        tier: '1_1',
        version: 1,
    },
    socialEnergizer_1_1_2: {
        title: 'Crowd Pleaser',
        description: 'React to 250 partner check-ins',
        bonusAbilityId: '',
        prerequisite: (userAchievements: { [key: string]: any }) => !!userAchievements.socialEnergizer_1_1_1,
        countToComplete: 250,
        xp: 200,
        pointReward: 6.00,
        mediaId: 'crowd-pleaser',
        tier: '1_1',
        version: 1,
    },

    // Tier 2 — celebrating partner milestones
    socialEnergizer_1_2: {
        title: 'Milestone Maker',
        description: 'Celebrate a partner milestone',
        bonusAbilityId: '',
        prerequisite: (userAchievements: { [key: string]: any }) => true,
        countToComplete: 1,
        xp: 15,
        pointReward: 0.50,
        mediaId: 'milestone-maker',
        tier: '1_2',
        version: 1,
    },
    socialEnergizer_1_2_1: {
        title: 'Confetti Cannon',
        description: 'Celebrate 25 partner milestones',
        bonusAbilityId: '',
        prerequisite: (userAchievements: { [key: string]: any }) => !!userAchievements.socialEnergizer_1_2,
        countToComplete: 25,
        xp: 150,
        pointReward: 5.00,
        mediaId: 'confetti-cannon',
        tier: '1_2',
        version: 1,
    },
};

export default socialEnergizerAchievements;
