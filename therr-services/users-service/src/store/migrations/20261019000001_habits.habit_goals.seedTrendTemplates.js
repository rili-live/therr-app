/**
 * Adds eight HABITS templates named in the vocabulary of habits people already think are cool.
 *
 * The adjacency play in docs/ADJACENCY_MARKETING.md: the cheapest attention to buy, and the
 * easiest to convert, is attention already pointed at something popular — step challenges,
 * zone 2, cold showers, a sober-curious month, the two-minute rule. The search campaign in
 * scripts/google-ads/campaigns/habits-web-adjacent.yaml bids on those intents and the landing
 * page lists them, so a visitor who clicked "step challenge with friends" has to find that
 * exact pact in the picker on first open. That is what these rows are for.
 *
 * Names are the trend's generic words, never a trademark or a program's name — a template
 * called after a branded challenge would promise its rules, which a pact does not enforce.
 * They go into existing categories so the picker needs no change; a dedicated "Trending" row
 * would be a mobile change on niche/HABITS-general.
 *
 * Mobile translates templates from `pages.pacts.templates.<templateKey>` and falls back to the
 * stored English below until those keys ship (see 20260925000001).
 *
 * Idempotency and env safety follow 20260925000002: ON CONFLICT (id) DO NOTHING against stable
 * UUIDs, and the inserts are skipped with a warning when the SUPER_ADMIN_ID row is missing.
 */

// Mirrors therr-services/users-service/src/constants/index.ts — see 20260510000001.
const SUPER_ADMIN_IDS = {
    development: '04e65180-3cff-48b1-988f-4b6e0ab25def',
    stage: '04e65180-3cff-48b1-988f-4b6e0ab25def',
    production: '568bf5d2-8595-4fd6-95da-32cc318618d3',
};

const daily = { frequencyType: 'daily', frequencyCount: 1, targetDaysOfWeek: null };
const perWeek = (count) => ({ frequencyType: 'weekly', frequencyCount: count, targetDaysOfWeek: null });

const TREND_TEMPLATES = [
    // fitness
    {
        id: 'b0000044-de00-4000-a000-000000000044',
        templateKey: 'steps10k',
        name: 'Hit 10,000 steps',
        description: 'Get your steps in, however you walk them',
        category: 'fitness',
        emoji: '👟',
        goalType: 'build_good',
        ...daily,
    },
    {
        id: 'b0000045-de00-4000-a000-000000000045',
        templateKey: 'zone2Cardio',
        name: 'Zone 2 cardio',
        description: '30+ minutes at an easy pace you could hold a conversation at',
        category: 'fitness',
        emoji: '🚴',
        goalType: 'build_good',
        ...perWeek(3),
    },
    // health
    {
        id: 'b0000046-de00-4000-a000-000000000046',
        templateKey: 'coldShower',
        name: 'Cold shower',
        description: 'Finish your shower with at least 30 seconds of cold',
        category: 'health',
        emoji: '🧊',
        goalType: 'build_good',
        ...daily,
    },
    {
        id: 'b0000047-de00-4000-a000-000000000047',
        templateKey: 'proteinGoal',
        name: 'Hit your protein goal',
        description: 'Reach the daily protein target you set for yourself',
        category: 'health',
        emoji: '🍳',
        goalType: 'build_good',
        ...daily,
    },
    {
        id: 'b0000048-de00-4000-a000-000000000048',
        templateKey: 'noAddedSugar',
        name: 'No added sugar',
        description: 'A day without sweets, soda or sugary snacks',
        category: 'health',
        emoji: '🍬',
        goalType: 'break_bad',
        ...daily,
    },
    {
        id: 'b0000049-de00-4000-a000-000000000049',
        templateKey: 'soberCurious',
        name: 'Sober-curious month',
        description: 'An alcohol-free day — pair it with a 30-day pact',
        category: 'health',
        emoji: '🫧',
        goalType: 'break_bad',
        ...daily,
    },
    // mindfulness (shown as "Mind & Mental Health")
    {
        id: 'b0000050-de00-4000-a000-000000000050',
        templateKey: 'morningSunlight',
        name: 'Morning sunlight',
        description: '10 minutes of daylight soon after you wake up',
        category: 'mindfulness',
        emoji: '🌅',
        goalType: 'build_good',
        ...daily,
    },
    // productivity (shown as "Focus & Screen Time")
    {
        id: 'b0000051-de00-4000-a000-000000000051',
        templateKey: 'twoMinuteStart',
        name: 'Two-minute start',
        description: 'Do just the first two minutes — showing up is the habit',
        category: 'productivity',
        emoji: '⏱️',
        goalType: 'build_good',
        ...daily,
    },
];

// A Postgres array literal, bound as a string — see 20260925000002.
const toIntArrayLiteral = (days) => (days ? `{${days.join(',')}}` : null);

exports.up = async (knex) => {
    const env = process.env.NODE_ENV || 'development';
    const ownerId = SUPER_ADMIN_IDS[env];
    if (!ownerId) {
        throw new Error(`Unknown NODE_ENV '${env}' — cannot resolve SUPER_ADMIN_ID for habit_goals template seed`);
    }

    const ownerExists = await knex('main.users').where({ id: ownerId }).first('id');
    if (!ownerExists) {
        // eslint-disable-next-line no-console
        console.warn(
            `[20261019000001_habits.habit_goals.seedTrendTemplates] SUPER_ADMIN_ID ${ownerId} not present in main.users `
            + `for env '${env}'. Skipping template inserts — re-run migrations after creating the admin row.`,
        );
        return;
    }

    await Promise.all(TREND_TEMPLATES.map((t) => knex.raw(`
        INSERT INTO habits.habit_goals (
            id, "templateKey", name, description, category, emoji,
            "frequencyType", "frequencyCount", "targetDaysOfWeek", "goalType",
            "createdByUserId", "isTemplate", "isPublic"
        ) VALUES (
            ?::uuid, ?, ?, ?, ?, ?,
            ?, ?, ?::integer[], ?,
            ?::uuid, true, true
        ) ON CONFLICT (id) DO NOTHING
    `, [
        t.id, t.templateKey, t.name, t.description, t.category, t.emoji,
        t.frequencyType, t.frequencyCount, toIntArrayLiteral(t.targetDaysOfWeek), t.goalType,
        ownerId,
    ])));
};

// Pacts, check-ins and streaks cascade from habit_goals, so audit dependent rows before running
// this against production — a user may have tracked one of these templates directly.
exports.down = async (knex) => {
    await knex('habits.habit_goals')
        .whereIn('id', TREND_TEMPLATES.map((t) => t.id))
        .delete();
};
