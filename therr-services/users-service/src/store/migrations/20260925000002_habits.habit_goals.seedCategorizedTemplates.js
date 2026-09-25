/**
 * Grows the HABITS template picker from seven templates to eight browsable categories.
 *
 * Three things happen here:
 *
 * 1. Every template gets a `templateKey` (added by the previous migration), which the
 *    mobile app uses to translate the template's name and description.
 * 2. Two of the original seven are corrected in place. "Morning workout — before 9am" baked
 *    a time of day into a habit whose cadence the user already chooses, so it becomes
 *    "Work out", three times a week, whenever fits. "Save for a group trip" moves from
 *    `social` to the new `money` category. A pact normally clones its template at creation
 *    time, so those copies keep the text they were made with. A pact pointing at the template
 *    row itself is possible, though, so the cadence change skips any template in use.
 * 3. Thirty-six new templates are inserted.
 *
 * Categories are the existing `category` column. The keys below are the complete set the
 * picker orders; anything else is shown last under "Other":
 *   fitness, money, mindfulness, health, productivity, learning, social, home
 *
 * Template names describe *what*, never *when* — time of day is the user's call, and the
 * cadence here is only the picker's starting value.
 *
 * Cadence encoding matches `utilities/habitCadence.ts`: `daily`; `weekly` + count for "N per
 * week"; `weekly` + `targetDaysOfWeek` (Sunday-first, 0-6) with count = number of days for
 * fixed weekdays.
 *
 * Idempotency: the corrections are UPDATEs by id to fixed values, and inserts are
 * ON CONFLICT (id) DO NOTHING against stable UUIDs, so a re-run is a no-op.
 *
 * Env safety: as with 20260510000001, inserts need the SUPER_ADMIN_ID row in main.users and
 * are skipped with a warning when it is missing. The in-place corrections still run, so a dev
 * database carrying the alice-owned copies from 004_dev_habits.js gets its keys either way.
 */

// Mirrors therr-services/users-service/src/constants/index.ts — see 20260510000001.
const SUPER_ADMIN_IDS = {
    development: '04e65180-3cff-48b1-988f-4b6e0ab25def',
    stage: '04e65180-3cff-48b1-988f-4b6e0ab25def',
    production: '568bf5d2-8595-4fd6-95da-32cc318618d3',
};

const MON_WED_FRI = [1, 3, 5];
const WEEKDAYS = [1, 2, 3, 4, 5];

const daily = { frequencyType: 'daily', frequencyCount: 1, targetDaysOfWeek: null };
const perWeek = (count) => ({ frequencyType: 'weekly', frequencyCount: count, targetDaysOfWeek: null });
const onDays = (days) => ({ frequencyType: 'weekly', frequencyCount: days.length, targetDaysOfWeek: days });

// The seven templates seeded by 20260510000001, as they should read from now on.
const EXISTING_TEMPLATES = [
    {
        id: 'b0000001-de00-4000-a000-000000000001',
        templateKey: 'workOut',
        name: 'Work out',
        description: '20+ minutes of movement, whenever fits your day',
        category: 'fitness',
        emoji: '🏋️',
        goalType: 'build_good',
        ...perWeek(3),
    },
    {
        id: 'b0000002-de00-4000-a000-000000000002',
        templateKey: 'read15',
        name: 'Read 15 minutes',
        description: 'Read a book (no phone) for 15 minutes daily',
        category: 'learning',
        emoji: '📚',
        goalType: 'build_good',
        ...daily,
    },
    {
        id: 'b0000003-de00-4000-a000-000000000003',
        templateKey: 'meditate',
        name: 'Meditation',
        description: '10 minutes of guided or silent meditation',
        category: 'mindfulness',
        emoji: '🧘',
        goalType: 'build_good',
        ...daily,
    },
    {
        id: 'b0000004-de00-4000-a000-000000000004',
        templateKey: 'drinkWater',
        name: 'Drink 64oz water',
        description: 'Hit your hydration target by end of day',
        category: 'health',
        emoji: '💧',
        goalType: 'build_good',
        ...daily,
    },
    {
        id: 'b0000005-de00-4000-a000-000000000005',
        templateKey: 'dailyJournal',
        name: 'Daily journal',
        description: '3 sentences: what went well, what didn\'t, what\'s next',
        category: 'mindfulness',
        emoji: '📓',
        goalType: 'build_good',
        ...daily,
    },
    {
        id: 'b0000006-de00-4000-a000-000000000006',
        templateKey: 'phoneFreeFirstHour',
        name: 'No phone first hour',
        description: 'No phone for the first hour after waking',
        category: 'productivity',
        emoji: '📵',
        goalType: 'break_bad',
        ...daily,
    },
    {
        id: 'b0000007-de00-4000-a000-000000000007',
        templateKey: 'saveGroupTrip',
        name: 'Save for a group trip',
        description: 'Set aside money each week toward a vacation with friends or family',
        category: 'money',
        emoji: '✈️',
        goalType: 'savings_goal',
        ...perWeek(1),
    },
];

const NEW_TEMPLATES = [
    // fitness
    {
        id: 'b0000008-de00-4000-a000-000000000008',
        templateKey: 'goForWalk',
        name: 'Go for a walk',
        description: 'At least 20 minutes on foot',
        category: 'fitness',
        emoji: '🚶',
        goalType: 'build_good',
        ...daily,
    },
    {
        id: 'b0000009-de00-4000-a000-000000000009',
        templateKey: 'strengthTraining',
        name: 'Strength training',
        description: 'Weights, bodyweight or bands — build strength that lasts',
        category: 'fitness',
        emoji: '💪',
        goalType: 'build_good',
        ...onDays(MON_WED_FRI),
    },
    {
        id: 'b0000010-de00-4000-a000-000000000010',
        templateKey: 'stretch',
        name: 'Stretch for 10 minutes',
        description: '10 minutes of stretching or mobility work',
        category: 'fitness',
        emoji: '🤸',
        goalType: 'build_good',
        ...daily,
    },
    {
        id: 'b0000011-de00-4000-a000-000000000011',
        templateKey: 'run',
        name: 'Go for a run',
        description: 'Any distance, any pace — just get out and run',
        category: 'fitness',
        emoji: '🏃',
        goalType: 'build_good',
        ...perWeek(3),
    },
    {
        id: 'b0000012-de00-4000-a000-000000000012',
        templateKey: 'yoga',
        name: 'Yoga',
        description: 'From a quick flow to a full class',
        category: 'fitness',
        emoji: '🪷',
        goalType: 'build_good',
        ...perWeek(3),
    },
    // money
    {
        id: 'b0000013-de00-4000-a000-000000000013',
        templateKey: 'emergencyFund',
        name: 'Build an emergency fund',
        description: 'Set money aside each week until you have a safety cushion',
        category: 'money',
        emoji: '🛟',
        goalType: 'savings_goal',
        ...perWeek(1),
    },
    {
        id: 'b0000014-de00-4000-a000-000000000014',
        templateKey: 'noSpendDay',
        name: 'No-spend day',
        description: 'Buy nothing beyond the essentials today',
        category: 'money',
        emoji: '🪙',
        goalType: 'build_good',
        ...perWeek(3),
    },
    {
        id: 'b0000015-de00-4000-a000-000000000015',
        templateKey: 'trackSpending',
        name: 'Track every purchase',
        description: 'Log what you spent today so nothing slips by',
        category: 'money',
        emoji: '🧾',
        goalType: 'build_good',
        ...daily,
    },
    {
        id: 'b0000016-de00-4000-a000-000000000016',
        templateKey: 'packLunch',
        name: 'Pack your lunch',
        description: 'Bring lunch from home instead of buying it',
        category: 'money',
        emoji: '🥪',
        goalType: 'build_good',
        ...onDays(WEEKDAYS),
    },
    {
        id: 'b0000017-de00-4000-a000-000000000017',
        templateKey: 'pauseImpulseBuys',
        name: 'No impulse buys',
        description: 'Wait 24 hours before any non-essential purchase',
        category: 'money',
        emoji: '🛒',
        goalType: 'break_bad',
        ...daily,
    },
    // mindfulness (shown as "Mind & Mental Health")
    {
        id: 'b0000018-de00-4000-a000-000000000018',
        templateKey: 'gratitude',
        name: 'Three good things',
        description: 'Write down three things you\'re grateful for',
        category: 'mindfulness',
        emoji: '🙏',
        goalType: 'build_good',
        ...daily,
    },
    {
        id: 'b0000019-de00-4000-a000-000000000019',
        templateKey: 'getOutside',
        name: 'Get outside',
        description: '15 minutes outdoors in daylight',
        category: 'mindfulness',
        emoji: '🌳',
        goalType: 'build_good',
        ...daily,
    },
    {
        id: 'b0000020-de00-4000-a000-000000000020',
        templateKey: 'breathwork',
        name: 'Breathwork',
        description: '5 minutes of slow, deliberate breathing',
        category: 'mindfulness',
        emoji: '🌬️',
        goalType: 'build_good',
        ...daily,
    },
    {
        id: 'b0000021-de00-4000-a000-000000000021',
        templateKey: 'moodCheckIn',
        name: 'Check in with yourself',
        description: 'Take a few minutes to name how you\'re really feeling',
        category: 'mindfulness',
        emoji: '💭',
        goalType: 'build_good',
        ...perWeek(1),
    },
    // health
    {
        id: 'b0000022-de00-4000-a000-000000000022',
        templateKey: 'consistentBedtime',
        name: 'Consistent bedtime',
        description: 'In bed at the same time each night',
        category: 'health',
        emoji: '😴',
        goalType: 'build_good',
        ...daily,
    },
    {
        id: 'b0000023-de00-4000-a000-000000000023',
        templateKey: 'eatVegetables',
        name: 'Eat your veggies',
        description: 'A vegetable with every meal',
        category: 'health',
        emoji: '🥦',
        goalType: 'build_good',
        ...daily,
    },
    {
        id: 'b0000024-de00-4000-a000-000000000024',
        templateKey: 'takeVitamins',
        name: 'Take your vitamins',
        description: 'Your daily vitamins or medication, every day',
        category: 'health',
        emoji: '💊',
        goalType: 'build_good',
        ...daily,
    },
    {
        id: 'b0000025-de00-4000-a000-000000000025',
        templateKey: 'cutBackAlcohol',
        name: 'Cut back on alcohol',
        description: 'An alcohol-free day',
        category: 'health',
        emoji: '🍷',
        goalType: 'break_bad',
        ...daily,
    },
    {
        id: 'b0000026-de00-4000-a000-000000000026',
        templateKey: 'quitNicotine',
        name: 'Quit vaping or smoking',
        description: 'Stay nicotine-free today',
        category: 'health',
        emoji: '🚭',
        goalType: 'break_bad',
        ...daily,
    },
    // productivity (shown as "Focus & Screen Time")
    {
        id: 'b0000027-de00-4000-a000-000000000027',
        templateKey: 'noScrollingInBed',
        name: 'No scrolling in bed',
        description: 'Your phone stays out of reach once you\'re in bed',
        category: 'productivity',
        emoji: '🌙',
        goalType: 'break_bad',
        ...daily,
    },
    {
        id: 'b0000028-de00-4000-a000-000000000028',
        templateKey: 'deepWork',
        name: 'Deep work block',
        description: '60 minutes of focused work, notifications off',
        category: 'productivity',
        emoji: '🎯',
        goalType: 'build_good',
        ...onDays(WEEKDAYS),
    },
    {
        id: 'b0000029-de00-4000-a000-000000000029',
        templateKey: 'planTomorrow',
        name: 'Plan tomorrow tonight',
        description: 'Write down your top three for tomorrow before bed',
        category: 'productivity',
        emoji: '🗒️',
        goalType: 'build_good',
        ...daily,
    },
    {
        id: 'b0000030-de00-4000-a000-000000000030',
        templateKey: 'screenTimeLimit',
        name: 'Stay under your screen-time limit',
        description: 'Keep social media under the daily limit you set',
        category: 'productivity',
        emoji: '📱',
        goalType: 'break_bad',
        ...daily,
    },
    // learning (shown as "Learning & Creativity")
    {
        id: 'b0000031-de00-4000-a000-000000000031',
        templateKey: 'practiceLanguage',
        name: 'Practice a language',
        description: '10 minutes of vocabulary, listening or conversation',
        category: 'learning',
        emoji: '🗣️',
        goalType: 'build_good',
        ...daily,
    },
    {
        id: 'b0000032-de00-4000-a000-000000000032',
        templateKey: 'practiceInstrument',
        name: 'Practice an instrument',
        description: '20 minutes of focused practice',
        category: 'learning',
        emoji: '🎸',
        goalType: 'build_good',
        ...perWeek(4),
    },
    {
        id: 'b0000033-de00-4000-a000-000000000033',
        templateKey: 'write300',
        name: 'Write 300 words',
        description: 'Fiction, essays or notes — just get words down',
        category: 'learning',
        emoji: '✍️',
        goalType: 'build_good',
        ...daily,
    },
    {
        id: 'b0000034-de00-4000-a000-000000000034',
        templateKey: 'sketch',
        name: 'Draw or sketch',
        description: 'Fill a page, however rough',
        category: 'learning',
        emoji: '🎨',
        goalType: 'build_good',
        ...perWeek(3),
    },
    // social (shown as "Relationships")
    {
        id: 'b0000035-de00-4000-a000-000000000035',
        templateKey: 'reachOutFriend',
        name: 'Reach out to a friend',
        description: 'A call, text or coffee with someone you haven\'t talked to lately',
        category: 'social',
        emoji: '👋',
        goalType: 'build_good',
        ...perWeek(1),
    },
    {
        id: 'b0000036-de00-4000-a000-000000000036',
        templateKey: 'callFamily',
        name: 'Call family',
        description: 'Catch up with family by phone or video',
        category: 'social',
        emoji: '📞',
        goalType: 'build_good',
        ...perWeek(1),
    },
    {
        id: 'b0000037-de00-4000-a000-000000000037',
        templateKey: 'phoneFreeMeals',
        name: 'Phone-free meals',
        description: 'Phones away while you eat with others',
        category: 'social',
        emoji: '🍽️',
        goalType: 'build_good',
        ...daily,
    },
    {
        id: 'b0000038-de00-4000-a000-000000000038',
        templateKey: 'dateNight',
        name: 'Date night',
        description: 'Dedicated time with your partner',
        category: 'social',
        emoji: '💞',
        goalType: 'build_good',
        ...perWeek(1),
    },
    {
        id: 'b0000039-de00-4000-a000-000000000039',
        templateKey: 'kindness',
        name: 'One act of kindness',
        description: 'Do one kind thing for someone today',
        category: 'social',
        emoji: '💛',
        goalType: 'build_good',
        ...daily,
    },
    // home (shown as "Home & Routine")
    {
        id: 'b0000040-de00-4000-a000-000000000040',
        templateKey: 'tidy10',
        name: '10-minute tidy',
        description: 'Reset one space in your home',
        category: 'home',
        emoji: '🧹',
        goalType: 'build_good',
        ...daily,
    },
    {
        id: 'b0000041-de00-4000-a000-000000000041',
        templateKey: 'makeBed',
        name: 'Make your bed',
        description: 'Start the day with one thing done',
        category: 'home',
        emoji: '🛏️',
        goalType: 'build_good',
        ...daily,
    },
    {
        id: 'b0000042-de00-4000-a000-000000000042',
        templateKey: 'mealPrep',
        name: 'Weekly meal prep',
        description: 'Cook ahead for the week',
        category: 'home',
        emoji: '🍱',
        goalType: 'build_good',
        ...perWeek(1),
    },
    {
        id: 'b0000043-de00-4000-a000-000000000043',
        templateKey: 'laundry',
        name: 'Laundry day',
        description: 'Wash, dry, fold and put away',
        category: 'home',
        emoji: '🧺',
        goalType: 'build_good',
        ...perWeek(1),
    },
];

// A Postgres array literal, bound as a string. knex.raw expands a JS array binding into a
// comma-separated list, which would not survive the `::integer[]` cast.
const toIntArrayLiteral = (days) => (days ? `{${days.join(',')}}` : null);

const templateColumnValues = (t) => [
    t.templateKey, t.name, t.description, t.category, t.emoji,
    t.frequencyType, t.frequencyCount, toIntArrayLiteral(t.targetDaysOfWeek), t.goalType,
];

exports.up = async (knex) => {
    // Corrections first, independent of the admin row: they target rows by id and simply
    // match nothing where the originals were never seeded.
    await Promise.all(EXISTING_TEMPLATES.map((t) => knex.raw(`
        UPDATE habits.habit_goals SET
            "templateKey" = ?, name = ?, description = ?, category = ?, emoji = ?, "goalType" = ?,
            "updatedAt" = now()
        WHERE id = ?::uuid AND "isTemplate" = true
    `, [t.templateKey, t.name, t.description, t.category, t.emoji, t.goalType, t.id])));

    // Cadence is corrected only on a template nothing is tracking. The server accepts a
    // template's own id as a pact's `habitGoalId` (the dev seed does exactly that, and the
    // mobile wizard falls back to it when its clone fails), and cadence is read off this row
    // by streaks, freezes and reminders. Rewriting it here — with no `cadenceEffectiveFrom`
    // stamp — would turn a live daily habit into 3x/week and re-judge its past days.
    await Promise.all(EXISTING_TEMPLATES.map((t) => knex.raw(`
        UPDATE habits.habit_goals g SET
            "frequencyType" = ?, "frequencyCount" = ?, "targetDaysOfWeek" = ?::integer[]
        WHERE g.id = ?::uuid AND g."isTemplate" = true
            AND NOT EXISTS (SELECT 1 FROM habits.pacts p WHERE p."habitGoalId" = g.id)
            AND NOT EXISTS (SELECT 1 FROM habits.user_habits u WHERE u."habitGoalId" = g.id)
            AND NOT EXISTS (SELECT 1 FROM habits.habit_checkins c WHERE c."habitGoalId" = g.id)
    `, [t.frequencyType, t.frequencyCount, toIntArrayLiteral(t.targetDaysOfWeek), t.id])));

    const env = process.env.NODE_ENV || 'development';
    const ownerId = SUPER_ADMIN_IDS[env];
    if (!ownerId) {
        throw new Error(`Unknown NODE_ENV '${env}' — cannot resolve SUPER_ADMIN_ID for habit_goals template seed`);
    }

    const ownerExists = await knex('main.users').where({ id: ownerId }).first('id');
    if (!ownerExists) {
        // eslint-disable-next-line no-console
        console.warn(
            `[20260925000002_habits.habit_goals.seedCategorizedTemplates] SUPER_ADMIN_ID ${ownerId} not present in main.users `
            + `for env '${env}'. Skipping template inserts — re-run migrations after creating the admin row.`,
        );
        return;
    }

    // The originals are included so an environment that skipped 20260510000001 for want of the
    // admin row gets the full set now; where they already exist the UPDATE above covered them.
    await Promise.all([...EXISTING_TEMPLATES, ...NEW_TEMPLATES].map((t) => knex.raw(`
        INSERT INTO habits.habit_goals (
            id, "templateKey", name, description, category, emoji,
            "frequencyType", "frequencyCount", "targetDaysOfWeek", "goalType",
            "createdByUserId", "isTemplate", "isPublic"
        ) VALUES (
            ?::uuid, ?, ?, ?, ?, ?,
            ?, ?, ?::integer[], ?,
            ?::uuid, true, true
        ) ON CONFLICT (id) DO NOTHING
    `, [t.id, ...templateColumnValues(t), ownerId])));
};

// Removes the new templates and restores the two corrected originals. As with
// 20260510000001, pacts/check-ins/streaks cascade from habit_goals, so audit dependent rows
// before running this against production.
exports.down = async (knex) => {
    await knex('habits.habit_goals')
        .whereIn('id', NEW_TEMPLATES.map((t) => t.id))
        .delete();

    await knex.raw(`
        UPDATE habits.habit_goals SET
            name = 'Morning workout', description = '20-minute movement session before 9am',
            "frequencyType" = 'daily', "frequencyCount" = 1, "updatedAt" = now()
        WHERE id = 'b0000001-de00-4000-a000-000000000001'::uuid
    `);
    await knex.raw(`
        UPDATE habits.habit_goals SET category = 'social', "updatedAt" = now()
        WHERE id = 'b0000007-de00-4000-a000-000000000007'::uuid
    `);
    await knex.raw(`
        UPDATE habits.habit_goals SET "templateKey" = NULL
        WHERE id IN (${EXISTING_TEMPLATES.map(() => '?::uuid').join(', ')})
    `, EXISTING_TEMPLATES.map((t) => t.id));
};
