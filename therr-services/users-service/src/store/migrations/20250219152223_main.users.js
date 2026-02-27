// eslint-disable-next-line import/no-extraneous-dependencies, @typescript-eslint/no-var-requires
const { BrandVariations } = require('../../../../../therr-public-library/therr-js-utilities/lib/constants');

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = (knex) => knex.schema.withSchema('main').alterTable('users', (table) => {
    table.jsonb('brandVariations').notNullable().defaultTo(JSON.stringify([{
        brand: BrandVariations.THERR,
        details: {},
    }]));
});

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = (knex) => knex.schema.withSchema('main').alterTable('users', (table) => {
    table.dropColumn('brandVariations');
});
