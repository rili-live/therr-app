/**
 * Seed file for development users
 * Run with: npm run seeds:run (from users-service directory)
 *
 * Generates 20 random users for local development and testing.
 * All users have the password: "TestPass123!"
 *
 * Uses ON CONFLICT DO NOTHING to gracefully handle existing data in all environments.
 * If the data already exists, it will be skipped without error.
 */

const bcrypt = require('bcrypt'); // eslint-disable-line @typescript-eslint/no-var-requires

const SALT_ROUNDS = 10;
const DEFAULT_PASSWORD = 'TestPass123!';

const firstNames = [
    'Alice', 'Bob', 'Charlie', 'Diana', 'Ethan',
    'Fiona', 'George', 'Hannah', 'Isaac', 'Julia',
    'Kevin', 'Laura', 'Marcus', 'Nina', 'Oscar',
    'Priya', 'Quinn', 'Rachel', 'Sam', 'Tara',
];

const lastNames = [
    'Anderson', 'Baker', 'Chen', 'Davis', 'Evans',
    'Foster', 'Garcia', 'Harris', 'Ito', 'Johnson',
    'Kim', 'Lee', 'Martinez', 'Nguyen', 'Olsen',
    'Patel', 'Quinn', 'Rivera', 'Smith', 'Taylor',
];

// Pre-generated UUIDs for idempotent seeding
const userIds = [
    'a0000001-de00-4000-a000-d00000000001',
    'a0000002-de00-4000-a000-d00000000002',
    'a0000003-de00-4000-a000-d00000000003',
    'a0000004-de00-4000-a000-d00000000004',
    'a0000005-de00-4000-a000-d00000000005',
    'a0000006-de00-4000-a000-d00000000006',
    'a0000007-de00-4000-a000-d00000000007',
    'a0000008-de00-4000-a000-d00000000008',
    'a0000009-de00-4000-a000-d00000000009',
    'a000000a-de00-4000-a000-d0000000000a',
    'a000000b-de00-4000-a000-d0000000000b',
    'a000000c-de00-4000-a000-d0000000000c',
    'a000000d-de00-4000-a000-d0000000000d',
    'a000000e-de00-4000-a000-d0000000000e',
    'a000000f-de00-4000-a000-d0000000000f',
    'a0000010-de00-4000-a000-d00000000010',
    'a0000011-de00-4000-a000-d00000000011',
    'a0000012-de00-4000-a000-d00000000012',
    'a0000013-de00-4000-a000-d00000000013',
    'a0000014-de00-4000-a000-d00000000014',
];

const generateUsers = (hashedPassword) => userIds.map((id, i) => ({
    id,
    email: `${firstNames[i].toLowerCase()}.${lastNames[i].toLowerCase()}@test.local`,
    userName: `${firstNames[i].toLowerCase()}${lastNames[i].toLowerCase()}`,
    firstName: firstNames[i],
    lastName: lastNames[i],
    password: hashedPassword,
    hasAgreedToTerms: true,
    accessLevels: JSON.stringify(['user.default', 'user.verified.mobile', 'user.verified.email']),
    verificationCodes: JSON.stringify({ email: {}, mobile: {} }),
    brandVariations: JSON.stringify([{ brand: 'therr', details: {} }]),
    settingsIsProfilePublic: true,
    settingsLocale: 'en-us',
    settingsThemeName: 'light',
    settingsBio: `Hi, I'm ${firstNames[i]}! This is a dev test account.`,
    loginCount: 0,
    isBlocked: false,
    isBusinessAccount: i >= 18, // Last 2 users are business accounts
    isCreatorAccount: i >= 16 && i < 18, // 2 creator accounts
}));

exports.seed = async (knex) => {
    const hashedPassword = await bcrypt.hash(DEFAULT_PASSWORD, SALT_ROUNDS);
    const users = generateUsers(hashedPassword);

    const results = await Promise.all(
        users.map((user) => knex.raw(`
            INSERT INTO main.users (
                id, email, "userName", "firstName", "lastName", password,
                "hasAgreedToTerms", "accessLevels", "verificationCodes",
                "brandVariations", "settingsIsProfilePublic", "settingsLocale",
                "settingsThemeName", "settingsBio", "loginCount",
                "isBlocked", "isBusinessAccount", "isCreatorAccount"
            )
            VALUES (
                ?::uuid, ?, ?, ?, ?, ?,
                ?, ?::jsonb, ?::jsonb,
                ?::jsonb, ?, ?,
                ?, ?, ?,
                ?, ?, ?
            )
            ON CONFLICT (id) DO NOTHING
        `, [
            user.id, user.email, user.userName, user.firstName, user.lastName, user.password,
            user.hasAgreedToTerms, user.accessLevels, user.verificationCodes,
            user.brandVariations, user.settingsIsProfilePublic, user.settingsLocale,
            user.settingsThemeName, user.settingsBio, user.loginCount,
            user.isBlocked, user.isBusinessAccount, user.isCreatorAccount,
        ])),
    );

    const inserted = results.filter((r) => r.rowCount > 0).length;
    const skipped = results.length - inserted;

    console.log(`Dev users seed complete: ${inserted} inserted, ${skipped} skipped (already exist)`);
    console.log('All dev users have password: "TestPass123!"');
};
