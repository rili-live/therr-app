// Per-habit notification preferences on habits.user_habits.
//
// WHY THIS EXISTS
//
// Until now the only controls a user had over habits pushes were two account-wide
// columns on `main.users` — `settingsPushHabitReminders` and `settingsPushStreakAlerts`
// (see `20260126000010_main.users_habits`) — plus the OS switch. All three are
// all-or-nothing across every habit the user tracks, so "keep reminding me to
// meditate, but stop telling me to nudge Dana about the gym" had exactly one
// available answer: turn habits notifications off entirely. That is the outcome
// the frequency research says costs DAU, and it is the outcome the app was pushing
// people toward.
//
// The tracking row is the right home for it. It is already one row per
// (user, habit), it is already the spine the digest's reminder pass walks
// (`UserHabitsStore.getActiveForReminders`), and it already survives a pact
// ending — so a preference set while a friend was involved is still there if
// another one joins later.
//
// WHY FOUR COLUMNS AND NOT A JSONB BLOB
//
// These are read inside the digest's hot loop and are gated on in SQL-adjacent
// code, so they want to be columns with a server-side default rather than keys
// that may or may not be present. Four booleans also make the "absent means
// opted in" rule impossible to get wrong — there is no absent. The categories
// are deliberately coarse; one toggle per PushNotifications.Types value would be
// a settings screen nobody reads.
//
//   notifyReminders       daily check-in nudge / morning motivation for this habit
//   notifyStreakAlerts    streak at risk, the evening last chance, broken, milestones
//   notifyPartnerActivity a partner checked in, or missed a day and could use a nudge
//   notifyPactUpdates     pact invited/accepted/declined/expiring/ended for this habit
//
// A direct person-to-person nudge (`pactNudge`) is deliberately NOT covered.
// Someone deliberately poking you is a message, not an automated reminder, and
// muting it here would make the sender think they had been heard. Blocking a
// person is the connection-level control for that.
//
// DEFAULTS AND BACKFILL
//
// NOT NULL DEFAULT true, which Postgres 11+ applies without rewriting the table.
// Existing rows therefore keep today's behaviour exactly — everything on — and
// no separate backfill pass is needed. The account-wide columns still apply and
// still win: these narrow what a user already receives, they never re-enable
// something the account-level switch turned off.
//
// No index. Every read of these columns is already keyed by (userId) or by the
// row id and filtered by `status`, both of which the existing indexes serve; a
// boolean column with ~one distinct value is not a useful leading edge.
//
// Idempotent (ADD COLUMN IF NOT EXISTS / DROP COLUMN IF EXISTS) per
// therr/require-idempotent-migration.

const COLUMNS = [
    'notifyReminders',
    'notifyStreakAlerts',
    'notifyPartnerActivity',
    'notifyPactUpdates',
];

/**
 * @param { import("knex").Knex } knex
 */
exports.up = async (knex) => {
    // eslint-disable-next-line no-restricted-syntax
    for (const column of COLUMNS) {
        // eslint-disable-next-line no-await-in-loop
        await knex.raw(
            `ALTER TABLE habits."user_habits"
             ADD COLUMN IF NOT EXISTS "${column}" boolean NOT NULL DEFAULT true`,
        );
    }
};

/**
 * @param { import("knex").Knex } knex
 */
exports.down = async (knex) => {
    // eslint-disable-next-line no-restricted-syntax
    for (const column of COLUMNS) {
        // eslint-disable-next-line no-await-in-loop
        await knex.raw(`ALTER TABLE habits."user_habits" DROP COLUMN IF EXISTS "${column}"`);
    }
};
