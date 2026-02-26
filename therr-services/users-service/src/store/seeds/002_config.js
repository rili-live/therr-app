/**
 * Seed file for the main.config table
 * Run with: npm run seeds:run (from users-service directory)
 *
 * Seeds default config values required by the application.
 * Without these, fetchExchangeRate returns a "missing-config" error which causes 429 errors.
 *
 * Uses ON CONFLICT DO NOTHING to gracefully handle existing data in all environments.
 * If the data already exists, it will be skipped without error.
 */

const configs = [
    {
        key: 'features.isAutoUserCreateEnabled',
        value: 'TRUE',
        type: 'BOOLEAN',
    },
    {
        key: 'therrDollarReserves',
        value: '1000',
        type: 'NUMBER',
    },
];

exports.seed = async (knex) => {
    const results = await Promise.all(
        configs.map((config) => knex.raw(`
            INSERT INTO main.config (id, key, value, type)
            VALUES (uuid_generate_v4(), ?, ?, ?)
            ON CONFLICT (key) DO NOTHING
        `, [
            config.key,
            config.value,
            config.type,
        ])),
    );

    const inserted = results.filter((r) => r.rowCount > 0).length;
    const skipped = results.length - inserted;

    console.log(`Config seed complete: ${inserted} inserted, ${skipped} skipped (already exist)`);
};