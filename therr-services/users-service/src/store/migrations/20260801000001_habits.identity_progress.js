// Identity progression state, one row per (user, habit goal).
//
// Streaks answer "how many days in a row?" — a number that resets to zero on the
// day a user most needs a reason to keep going. This table answers "who are you
// becoming?", and is deliberately built so that nothing here ever resets:
// `votesCast` only increments and `stage` only ratchets upward. See
// therr-js-utilities/src/config/habits/identityProgression.ts for the ladder and
// its rung requirements — the thresholds live there, not here, because the mobile
// client renders the same ladder.
//
// Denormalized evidence counters (comebackCount, reflectionCount,
// partnerAffirmationCount) are maintained on write rather than derived on read:
// the identity card renders on every habit screen, and recomputing a 90-day
// window from habit_checkins + streak_history on each render is not worth it.
exports.up = async function up(knex) {
    if (await knex.schema.withSchema('habits').hasTable('identity_progress')) {
        return;
    }
    await knex.schema.withSchema('habits').createTable('identity_progress', (table) => {
        table.uuid('id').primary().notNullable().defaultTo(knex.raw('uuid_generate_v4()'));

        // References
        table.uuid('userId').notNullable()
            .references('id').inTable('main.users')
            .onUpdate('CASCADE')
            .onDelete('CASCADE');
        table.uuid('habitGoalId').notNullable()
            .references('id').inTable('habits.habit_goals')
            .onUpdate('CASCADE')
            .onDelete('CASCADE');
        // Nullable and SET NULL on delete: an identity outlives the pact that started
        // it. Losing a partner must not erase who the user became.
        table.uuid('pactId')
            .references('id').inTable('habits.pacts')
            .onUpdate('CASCADE')
            .onDelete('SET NULL');

        // The identity statement, user-authored: "someone who runs before work".
        // Rendered verbatim, so it is free text rather than a template id.
        table.string('identityLabel', 120);
        table.timestamp('identityLabelSetAt', { useTz: true });

        // Ladder position. 0=intention, 1=repetition, 2=automaticity, 3=mindset,
        // 4=identity (IdentityStages). Integer so `stage >= 3` filters stay cheap.
        table.integer('stage').notNullable().defaultTo(0);
        table.timestamp('stageEnteredAt', { useTz: true }).notNullable().defaultTo(knex.fn.now());
        // Highest stage ever held. Equal to `stage` today since stages never drop, but
        // stored explicitly so a future rule change can't silently rewrite history.
        table.integer('highestStage').notNullable().defaultTo(0);

        // Evidence counters — every one of these is monotonic.
        table.integer('votesCast').notNullable().defaultTo(0);
        table.integer('comebackCount').notNullable().defaultTo(0);
        table.integer('reflectionCount').notNullable().defaultTo(0);
        table.integer('partnerAffirmationCount').notNullable().defaultTo(0);

        // Latest self-concept answer (1..5). Not a count — the current reading is what
        // the ladder gates on, so a user who has drifted is asked again rather than
        // held up by an answer they gave months ago.
        table.integer('selfConceptScore');
        table.timestamp('selfConceptScoredAt', { useTz: true });

        // Vote timeline, used for the elapsed-time rung and the dormancy display state.
        table.date('firstVoteDate');
        table.date('lastVoteDate');

        // Set the first time the user reaches IDENTITY. Never cleared.
        table.timestamp('identityConfirmedAt', { useTz: true });

        // Audit
        table.timestamp('createdAt', { useTz: true }).notNullable().defaultTo(knex.fn.now());
        table.timestamp('updatedAt', { useTz: true }).notNullable().defaultTo(knex.fn.now());

        // One identity per user per habit. Also the upsert conflict target.
        table.unique(['userId', 'habitGoalId']);

        table.index('userId');
        table.index('habitGoalId');
        table.index('pactId');
        // Leads on userId (most selective) for the dashboard's "my identities" read.
        table.index(['userId', 'stage']);
    });
};

exports.down = (knex) => knex.schema.withSchema('habits').dropTableIfExists('identity_progress');
