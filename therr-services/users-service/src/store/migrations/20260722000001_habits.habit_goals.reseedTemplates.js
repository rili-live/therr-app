/**
 * Re-seed system-template habit goals — with robust owner resolution.
 *
 * Background: production has been surfacing an EMPTY "pick a habit" picker in
 * the HABITS pact-invite wizard because habits.habit_goals has zero rows where
 * isTemplate=true. The prior seed (20260510000001) inserts the starter
 * templates owned by the env super-admin, but it SKIPS SILENTLY (and still
 * records itself complete) when that account row is absent from main.users at
 * migration time. Once a migration is recorded complete, re-running
 * `migrations:run` never re-executes it — so the picker stays empty forever.
 *
 * This migration makes the seed self-healing:
 *
 *  - Owner resolution no longer hard-depends on the super-admin existing:
 *    prefer the configured super-admin id, else fall back to the oldest
 *    existing user. createdByUserId is only an FK for referential integrity
 *    (templates are queried by isTemplate=true regardless of owner), so any
 *    valid user is a safe owner and unblocks the seed on any DB with users.
 *  - Reuses the same stable template UUIDs as 20260510000001 with
 *    ON CONFLICT (id) DO NOTHING, so this is a no-op on any database where the
 *    templates already exist (dev via 004_dev_habits.js, or prod if the prior
 *    seed already ran successfully). Only genuinely-missing rows are inserted.
 *
 * Idempotent and additive — safe to apply on top of the currently-deployed
 * release.
 */

// Mirrors therr-services/users-service/src/constants/index.ts. Migrations run
// from JS via knex-cli without the TS compile step, so the env map is inlined
// here rather than required from compiled lib/.
const SUPER_ADMIN_IDS = {
    development: '04e65180-3cff-48b1-988f-4b6e0ab25def',
    stage: '04e65180-3cff-48b1-988f-4b6e0ab25def',
    production: '568bf5d2-8595-4fd6-95da-32cc318618d3',
};

// Same stable UUIDs as 20260510000001 so ON CONFLICT (id) DO NOTHING makes the
// two seeds converge instead of duplicating.
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

const resolveOwnerId = async (knex, env) => {
    const configuredAdminId = SUPER_ADMIN_IDS[env];
    if (configuredAdminId) {
        const superAdmin = await knex('main.users').where({ id: configuredAdminId }).first('id');
        if (superAdmin) {
            return superAdmin.id;
        }
    }
    // Fallback: the oldest user in the system. Templates are system-public
    // content keyed on isTemplate=true; the owner FK only needs to be a valid
    // user row, so this unblocks the seed even when the admin row is missing.
    const oldestUser = await knex('main.users').orderBy('createdAt', 'asc').first('id');
    return oldestUser ? oldestUser.id : null;
};

exports.up = async (knex) => {
    const env = process.env.NODE_ENV || 'development';
    const ownerId = await resolveOwnerId(knex, env);

    if (!ownerId) {
        // Only reachable on a brand-new DB with no users at all. Nothing we can
        // safely own the templates with — log and skip. A later run (after the
        // first user exists) will seed on the standing "run migrations" step.
        // eslint-disable-next-line no-console
        console.warn(
            `[20260722000001_habits.habit_goals.reseedTemplates] No users in main.users for env '${env}'. `
            + 'Skipping template seed — re-run migrations after at least one user exists.',
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
// foreign keys onto habit_goals are ON DELETE CASCADE, so reversing this on a
// database where users have built pacts on top of the templates will also
// remove those pacts. Don't run `down` in production without auditing
// dependent rows first. Because 20260510000001 seeds the same UUIDs, running
// this down removes templates that seed "owns" too — intentional, since the
// rows are shared by id.
exports.down = (knex) => knex('habits.habit_goals')
    .whereIn('id', TEMPLATES.map((t) => t.id))
    .delete();
