// Answers to identity reflection prompts — the mindset layer's evidence log.
//
// A check-in records that a behavior happened. Nothing in the schema until now
// records that the user started thinking about themselves differently, which is
// the layer between the habit and the identity. These rows are that record.
//
// Append-only by design: a reflection is a snapshot of what someone believed on a
// given day, and the value of the WHY answer is being able to re-read it during a
// lapse. Edits would destroy that. `identity_progress` caches the counts and the
// latest self-concept score; this table stays the source of truth.
exports.up = (knex) => knex.schema.withSchema('habits').createTable('identity_reflections', (table) => {
    table.uuid('id').primary().notNullable().defaultTo(knex.raw('uuid_generate_v4()'));

    // The identity this reflection is evidence for.
    table.uuid('identityProgressId').notNullable()
        .references('id').inTable('habits.identity_progress')
        .onUpdate('CASCADE')
        .onDelete('CASCADE');
    // Denormalized from identity_progress so the common "my reflections for this
    // habit" read needs no join.
    table.uuid('userId').notNullable()
        .references('id').inTable('main.users')
        .onUpdate('CASCADE')
        .onDelete('CASCADE');
    table.uuid('habitGoalId').notNullable()
        .references('id').inTable('habits.habit_goals')
        .onUpdate('CASCADE')
        .onDelete('CASCADE');
    // Who wrote it. Equals userId for self-reflections; for a partner affirmation
    // this is the partner — that difference is the whole point of the top rung.
    table.uuid('authorUserId').notNullable()
        .references('id').inTable('main.users')
        .onUpdate('CASCADE')
        .onDelete('CASCADE');
    // The check-in that triggered the prompt, when there was one.
    table.uuid('checkinId')
        .references('id').inTable('habits.habit_checkins')
        .onUpdate('CASCADE')
        .onDelete('SET NULL');

    // IdentityReflectionTypes: self_concept, why, obstacle, recommitment,
    // partner_affirmation.
    table.string('reflectionType', 40).notNullable();
    // i18n key suffix of the question as asked. Persisted so re-wording a prompt
    // later doesn't retroactively change what an old answer was answering.
    table.string('promptKey', 60).notNullable();

    // Scale prompts (self_concept) fill responseScore; text prompts fill
    // responseText. Both are nullable because the formats are mutually exclusive.
    table.integer('responseScore');
    table.text('responseText');

    table.timestamp('createdAt', { useTz: true }).notNullable().defaultTo(knex.fn.now());

    table.index('identityProgressId');
    table.index('authorUserId');
    // Serves both the reflection timeline and the per-type cooldown lookup that
    // decides whether a prompt may be asked again.
    table.index(['userId', 'habitGoalId', 'reflectionType', 'createdAt']);
});

exports.down = (knex) => knex.schema.withSchema('habits').dropTableIfExists('identity_reflections');
