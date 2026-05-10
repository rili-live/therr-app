/**
 * Seed system-template habit goals.
 *
 * Background: production has had zero rows in habits.habit_goals where
 * isTemplate=true, so the HABITS "pick a habit" picker has been empty. The
 * existing dev seed (004_dev_habits.js) installs six starter templates owned
 * by the local dev user alice — but that path never runs in prod.
 *
 * This migration installs those six starters under SUPER_ADMIN_ID (the
 * system/admin account) and adds a seventh savings-goal template aimed at
 * group savings (e.g. a vacation with friends/family).
 *
 * Idempotency: each template has a stable UUID. ON CONFLICT (id) DO NOTHING
 * means dev DBs that already have the six starter rows (seeded via
 * 004_dev_habits.js) will only get the new savings-goal row inserted; re-runs
 * are no-ops.
 *
 * Env safety: createdByUserId is a NOT NULL FK to main.users. In dev/stage
 * the super-admin row is created out-of-band — if it's missing the migration
 * logs a warning and skips. Local dev still has the alice-owned templates.
 */

// Mirrors therr-services/users-service/src/constants/index.ts. Migrations run
// from JS via knex-cli without the TS compile step, so the env map is inlined
// here rather than required from compiled lib/.
const SUPER_ADMIN_IDS = {
    development: '04e65180-3cff-48b1-988f-4b6e0ab25def',
    stage: '04e65180-3cff-48b1-988f-4b6e0ab25def',
    production: '568bf5d2-8595-4fd6-95da-32cc318618d3',
};

const TEMPLATES = [
    {
        id: 'b0000001-de00-4000-a000-000000000001',
        name: 'Morning workout',
        description: '20-minute movement session before 9am',
        category: 'fitness',
        emoji: '🏋️',
        frequencyType: 'daily',
        frequencyCount: 1,
        goalType: 'build_good',
    },
    {
        id: 'b0000002-de00-4000-a000-000000000002',
        name: 'Read 15 minutes',
        description: 'Read a book (no phone) for 15 minutes daily',
        category: 'learning',
        emoji: '📚',
        frequencyType: 'daily',
        frequencyCount: 1,
        goalType: 'build_good',
    },
    {
        id: 'b0000003-de00-4000-a000-000000000003',
        name: 'Meditation',
        description: '10 minutes of guided or silent meditation',
        category: 'mindfulness',
        emoji: '🧘',
        frequencyType: 'daily',
        frequencyCount: 1,
        goalType: 'build_good',
    },
    {
        id: 'b0000004-de00-4000-a000-000000000004',
        name: 'Drink 64oz water',
        description: 'Hit your hydration target by end of day',
        category: 'health',
        emoji: '💧',
        frequencyType: 'daily',
        frequencyCount: 1,
        goalType: 'build_good',
    },
    {
        id: 'b0000005-de00-4000-a000-000000000005',
        name: 'Daily journal',
        description: '3 sentences: what went well, what didn\'t, what\'s next',
        category: 'mindfulness',
        emoji: '📓',
        frequencyType: 'daily',
        frequencyCount: 1,
        goalType: 'build_good',
    },
    {
        id: 'b0000006-de00-4000-a000-000000000006',
        name: 'No phone first hour',
        description: 'No phone for the first hour after waking',
        category: 'productivity',
        emoji: '📵',
        frequencyType: 'daily',
        frequencyCount: 1,
        goalType: 'break_bad',
    },
    {
        id: 'b0000007-de00-4000-a000-000000000007',
        name: 'Save for a group trip',
        description: 'Set aside money each week toward a vacation with friends or family',
        category: 'social',
        emoji: '✈️',
        frequencyType: 'weekly',
        frequencyCount: 1,
        goalType: 'savings_goal',
    },
];

exports.up = async (knex) => {
    const env = process.env.NODE_ENV || 'development';
    const ownerId = SUPER_ADMIN_IDS[env];
    if (!ownerId) {
        throw new Error(`Unknown NODE_ENV '${env}' — cannot resolve SUPER_ADMIN_ID for habit_goals template seed`);
    }

    const ownerExists = await knex('main.users').where({ id: ownerId }).first('id');
    if (!ownerExists) {
        // Logged loudly so the operator notices and can re-run after creating
        // the admin user — but not thrown, so dev/stage migrations don't break
        // for environments that haven't provisioned that account yet.
        // eslint-disable-next-line no-console
        console.warn(
            `[20260510000001_habits.habit_goals.seedTemplates] SUPER_ADMIN_ID ${ownerId} not present in main.users `
            + `for env '${env}'. Skipping template seed — re-run migrations after creating the admin row.`,
        );
        return;
    }

    await Promise.all(TEMPLATES.map((t) => knex.raw(`
        INSERT INTO habits.habit_goals (
            id, name, description, category, emoji,
            "frequencyType", "frequencyCount", "goalType",
            "createdByUserId", "isTemplate", "isPublic"
        ) VALUES (
            ?::uuid, ?, ?, ?, ?,
            ?, ?, ?,
            ?::uuid, true, true
        ) ON CONFLICT (id) DO NOTHING
    `, [
        t.id, t.name, t.description, t.category, t.emoji,
        t.frequencyType, t.frequencyCount, t.goalType,
        ownerId,
    ])));
};

// Removes only the seeded template rows. Note: the pacts/checkins/streaks
// foreign keys onto habit_goals are ON DELETE CASCADE, so reversing this on
// a database where users have built pacts on top of the templates will also
// remove those pacts. Don't run `down` in production without auditing
// dependent rows first.
exports.down = (knex) => knex('habits.habit_goals')
    .whereIn('id', TEMPLATES.map((t) => t.id))
    .delete();
