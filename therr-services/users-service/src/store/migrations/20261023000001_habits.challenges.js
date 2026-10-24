// Join-by-link challenges (WORK_IN_PROGRESS § 2.7, #2988) and the founder-unlock referral reward.
//
// habits.challenges — one shared goal, a date window and a join token. Anyone holding the link
// can join. A challenge is NOT a big pact: pacts stay 2–5 specific people with partner-miss
// pushes, while a challenge is a public scoreboard over its members' own check-ins on the
// challenge's habit goal. It is a view over check-ins, never a new source of them.
//
//   status: active | ended | cancelled
//
// habits.challenge_members — who joined, and when. `joinedAt` is what the referral reward reads
// to decide whether a member was *brought* by the creator (their account is about as old as
// their join) or was already a user.
//
//   status: active | left
//
// habits.referral_rewards — at most one row per user, written when their invited friends
// became active enough to earn the founder unlock. The UNIQUE userId is what makes a racing
// second evaluation grant nothing and push nothing.
//
// habits schema, not a main.* brand-scoped table: like pact_join_requests and
// onboarding_messages, every row belongs to the HABITS app by construction.
//
// Idempotent per therr/require-idempotent-migration: hasTable probes guard createTable, and the
// tables are dropped IF EXISTS on the way down.

/**
 * @param { import("knex").Knex } knex
 */
exports.up = async (knex) => {
    const hasChallenges = await knex.schema.withSchema('habits').hasTable('challenges');
    if (!hasChallenges) {
        await knex.schema.withSchema('habits').createTable('challenges', (table) => {
            table.uuid('id').primary().notNullable().defaultTo(knex.raw('uuid_generate_v4()'));

            table.uuid('creatorUserId').notNullable()
                .references('id').inTable('main.users')
                .onUpdate('CASCADE')
                .onDelete('CASCADE');
            table.uuid('habitGoalId').notNullable()
                .references('id').inTable('habits.habit_goals')
                .onUpdate('CASCADE')
                .onDelete('CASCADE');

            table.string('title', 100);
            // Short and URL-safe, because it is the whole share link: habits.therr.com/c/<token>.
            table.string('joinToken', 32).notNullable().unique();
            table.date('startDate').notNullable();
            table.date('endDate').notNullable();
            table.integer('maxMembers').notNullable().defaultTo(50);
            table.string('status', 20).notNullable().defaultTo('active');

            table.timestamp('createdAt', { useTz: true }).notNullable().defaultTo(knex.fn.now());
            table.timestamp('updatedAt', { useTz: true }).notNullable().defaultTo(knex.fn.now());

            table.index(['creatorUserId', 'status']);
        });
    }

    const hasMembers = await knex.schema.withSchema('habits').hasTable('challenge_members');
    if (!hasMembers) {
        await knex.schema.withSchema('habits').createTable('challenge_members', (table) => {
            table.uuid('id').primary().notNullable().defaultTo(knex.raw('uuid_generate_v4()'));

            table.uuid('challengeId').notNullable()
                .references('id').inTable('habits.challenges')
                .onUpdate('CASCADE')
                .onDelete('CASCADE');
            table.uuid('userId').notNullable()
                .references('id').inTable('main.users')
                .onUpdate('CASCADE')
                .onDelete('CASCADE');

            table.string('status', 20).notNullable().defaultTo('active');
            table.timestamp('joinedAt', { useTz: true }).notNullable().defaultTo(knex.fn.now());

            table.timestamp('createdAt', { useTz: true }).notNullable().defaultTo(knex.fn.now());
            table.timestamp('updatedAt', { useTz: true }).notNullable().defaultTo(knex.fn.now());

            // One row per person per challenge: a re-join revives it rather than adding a second.
            table.unique(['challengeId', 'userId']);
            // "Which challenges am I in".
            table.index(['userId', 'status']);
        });
    }

    const hasRewards = await knex.schema.withSchema('habits').hasTable('referral_rewards');
    if (!hasRewards) {
        await knex.schema.withSchema('habits').createTable('referral_rewards', (table) => {
            table.uuid('id').primary().notNullable().defaultTo(knex.raw('uuid_generate_v4()'));

            table.uuid('userId').notNullable().unique()
                .references('id')
                .inTable('main.users')
                .onUpdate('CASCADE')
                .onDelete('CASCADE');
            // The friends whose activity earned it, kept for support questions and abuse review.
            table.jsonb('qualifyingUserIds').notNullable().defaultTo('[]');
            table.timestamp('grantedAt', { useTz: true }).notNullable().defaultTo(knex.fn.now());

            table.timestamp('createdAt', { useTz: true }).notNullable().defaultTo(knex.fn.now());
        });
    }
};

/**
 * @param { import("knex").Knex } knex
 */
exports.down = async (knex) => {
    await knex.schema.withSchema('habits').dropTableIfExists('referral_rewards');
    await knex.schema.withSchema('habits').dropTableIfExists('challenge_members');
    await knex.schema.withSchema('habits').dropTableIfExists('challenges');
};
