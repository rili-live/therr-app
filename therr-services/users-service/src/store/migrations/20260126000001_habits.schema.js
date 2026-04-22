exports.up = (knex) => knex.raw('CREATE SCHEMA IF NOT EXISTS habits');

exports.down = (knex) => knex.raw('DROP SCHEMA IF EXISTS habits CASCADE');
