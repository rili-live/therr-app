// IMPORTANT: Developers should update version after making any changes to these configs. An achievement key/id should never be changed
// NOTE: title and description should be translated by the consumer of this config
// using translation keys (ex. dailyStreak_1_1.title, dailyStreak_1_1.description)

// App-level DAILY STREAK achievements — the streak that counts days the user checked in on
// *any* habit, in their own timezone. Distinct from `habitBuilder`/`consistency`, which track a
// single habit: this class is what the celebration screens celebrate. Awarded by the evaluator
// (users-service handlers/helpers/dailyStreak.ts), which only reports a milestone the user has
// never reached before, so the ladder cannot be climbed twice by breaking and rebuilding.
//
// Tiers:
//   1_1 — streak length milestones (7 … 1000)
//   1_2 — perfect weeks (Mon–Sun, every day upheld by a real check-in, no frozen days)
//   1_3 — four consecutive perfect weeks
//   1_4 — comeback: a new streak reaches 7 after a reset from 30+
//   1_5 — a streak freeze saved the daily streak
const dailyStreakAchievements = {
    // Tier 1_1 — streak milestones. countToComplete is the milestone itself; the awarding side
    // passes the delta from the previous rung, so each completes exactly on its own day.
    dailyStreak_1_1: {
        title: 'Week One',
        description: 'Check in on any habit 7 days in a row',
        bonusAbilityId: '',
        prerequisite: (userAchievements: { [key: string]: any }) => true,
        countToComplete: 7,
        xp: 25,
        pointReward: 0.25,
        mediaId: 'daily-streak-7',
        tier: '1_1',
        version: 1,
    },
    dailyStreak_1_1_1: {
        title: 'Thirty Days',
        description: 'Reach a 30-day daily streak',
        bonusAbilityId: '',
        prerequisite: (userAchievements: { [key: string]: any }) => !!userAchievements.dailyStreak_1_1,
        countToComplete: 23,
        xp: 60,
        pointReward: 1.00,
        mediaId: 'daily-streak-30',
        tier: '1_1',
        version: 1,
    },
    dailyStreak_1_1_2: {
        title: 'Fifty Up',
        description: 'Reach a 50-day daily streak',
        bonusAbilityId: '',
        prerequisite: (userAchievements: { [key: string]: any }) => !!userAchievements.dailyStreak_1_1_1,
        countToComplete: 20,
        xp: 80,
        pointReward: 1.50,
        mediaId: 'daily-streak-50',
        tier: '1_1',
        version: 1,
    },
    dailyStreak_1_1_3: {
        title: 'Century',
        description: 'Reach a 100-day daily streak',
        bonusAbilityId: '',
        prerequisite: (userAchievements: { [key: string]: any }) => !!userAchievements.dailyStreak_1_1_2,
        countToComplete: 50,
        xp: 150,
        pointReward: 3.00,
        mediaId: 'daily-streak-100',
        tier: '1_1',
        version: 1,
    },
    dailyStreak_1_1_4: {
        title: 'Double Century',
        description: 'Reach a 200-day daily streak',
        bonusAbilityId: '',
        prerequisite: (userAchievements: { [key: string]: any }) => !!userAchievements.dailyStreak_1_1_3,
        countToComplete: 100,
        xp: 250,
        pointReward: 5.00,
        mediaId: 'daily-streak-200',
        tier: '1_1',
        version: 1,
    },
    dailyStreak_1_1_5: {
        title: 'Full Year',
        description: 'Reach a 365-day daily streak',
        bonusAbilityId: '',
        prerequisite: (userAchievements: { [key: string]: any }) => !!userAchievements.dailyStreak_1_1_4,
        countToComplete: 165,
        xp: 500,
        pointReward: 10.00,
        mediaId: 'daily-streak-365',
        tier: '1_1',
        version: 1,
    },
    dailyStreak_1_1_6: {
        title: 'Five Hundred',
        description: 'Reach a 500-day daily streak',
        bonusAbilityId: '',
        prerequisite: (userAchievements: { [key: string]: any }) => !!userAchievements.dailyStreak_1_1_5,
        countToComplete: 135,
        xp: 750,
        pointReward: 15.00,
        mediaId: 'daily-streak-500',
        tier: '1_1',
        version: 1,
    },
    dailyStreak_1_1_7: {
        title: 'Two Years',
        description: 'Reach a 730-day daily streak',
        bonusAbilityId: '',
        prerequisite: (userAchievements: { [key: string]: any }) => !!userAchievements.dailyStreak_1_1_6,
        countToComplete: 230,
        xp: 1000,
        pointReward: 20.00,
        mediaId: 'daily-streak-730',
        tier: '1_1',
        version: 1,
    },
    dailyStreak_1_1_8: {
        title: 'One Thousand',
        description: 'Reach a 1000-day daily streak',
        bonusAbilityId: '',
        prerequisite: (userAchievements: { [key: string]: any }) => !!userAchievements.dailyStreak_1_1_7,
        countToComplete: 270,
        xp: 1500,
        pointReward: 30.00,
        mediaId: 'daily-streak-1000',
        tier: '1_1',
        version: 1,
    },

    // Tier 1_2 — perfect weeks
    dailyStreak_1_2: {
        title: 'Perfect Week',
        description: 'Check in every day of a calendar week, with no freezes',
        bonusAbilityId: '',
        prerequisite: (userAchievements: { [key: string]: any }) => true,
        countToComplete: 1,
        xp: 40,
        pointReward: 0.50,
        mediaId: 'perfect-week-daily',
        tier: '1_2',
        version: 1,
    },
    dailyStreak_1_2_1: {
        title: 'Five Perfect Weeks',
        description: 'Complete five perfect weeks',
        bonusAbilityId: '',
        prerequisite: (userAchievements: { [key: string]: any }) => !!userAchievements.dailyStreak_1_2,
        countToComplete: 4,
        xp: 100,
        pointReward: 2.00,
        mediaId: 'perfect-week-daily-5',
        tier: '1_2',
        version: 1,
    },

    // Tier 1_3 — four perfect weeks back to back
    dailyStreak_1_3: {
        title: 'Perfect Month',
        description: 'Complete four perfect weeks in a row',
        bonusAbilityId: '',
        prerequisite: (userAchievements: { [key: string]: any }) => true,
        countToComplete: 1,
        xp: 150,
        pointReward: 3.00,
        mediaId: 'perfect-week-x4',
        tier: '1_3',
        version: 1,
    },

    // Tier 1_4 — comeback
    dailyStreak_1_4: {
        title: 'Right Back At It',
        description: 'Build a new 7-day streak after losing one of 30 days or more',
        bonusAbilityId: '',
        prerequisite: (userAchievements: { [key: string]: any }) => true,
        countToComplete: 1,
        xp: 75,
        pointReward: 1.50,
        mediaId: 'daily-streak-comeback',
        tier: '1_4',
        version: 1,
    },

    // Tier 1_5 — the safety net did its job
    dailyStreak_1_5: {
        title: 'Saved By A Freeze',
        description: 'Have a streak freeze protect your daily streak',
        bonusAbilityId: '',
        prerequisite: (userAchievements: { [key: string]: any }) => true,
        countToComplete: 1,
        xp: 20,
        pointReward: 0.25,
        mediaId: 'daily-streak-freeze-saved',
        tier: '1_5',
        version: 1,
    },
};

export default dailyStreakAchievements;
