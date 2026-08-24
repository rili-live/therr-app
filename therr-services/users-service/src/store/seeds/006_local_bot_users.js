/**
 * Seed file for location-based AI automator bot users
 * Run with: npm run seeds:run (from users-service directory)
 *
 * Creates 12 bot accounts (isBot=true) that each have a declared home city, one per US
 * metro, and one `main.userLocations` row per account marking that city as home
 * (isDeclaredHome=true). 005_bot_users.js seeds the same kind of account without a home;
 * these are additive, not a replacement.
 *
 * The home location is the contract with therr-ai-automator, and it is deliberately
 * expressed as coordinates rather than a city name: the automator reads each bot's declared
 * home out of `main.userLocations`, matches it to the nearest entry in its own metro
 * catalog (src/config/locales.ts), and writes some of that bot's posts *about* that city,
 * stamping `main.thoughts.latitude/longitude/locality`. users-service's thought distributor
 * then puts those posts in front of users who live nearby. Nothing keys off the city string,
 * so the two catalogs can drift in wording without breaking, and a bot whose coordinates
 * match no catalog entry simply posts non-local content.
 *
 * `botType` values must match persona keys in the automator's src/config/personas.ts — the
 * personality is resolved from that column. Each metro gets a different persona so the local
 * voices do not all sound alike; settingsBio is injected into generation prompts and is
 * written in that persona's voice, naming the city.
 *
 * Password can be overridden with BOT_SEED_PASSWORD; bots never log in interactively, so
 * the default is only a placeholder hash.
 *
 * Uses ON CONFLICT DO NOTHING to gracefully handle existing data in all environments.
 * If the data already exists, it will be skipped without error.
 */

const bcrypt = require('bcrypt'); // eslint-disable-line @typescript-eslint/no-var-requires

const SALT_ROUNDS = 10;
const DEFAULT_PASSWORD = process.env.BOT_SEED_PASSWORD || 'BotSeedPass2026!';

// Pre-generated UUIDs for idempotent seeding (b1-prefix = location-based bot accounts,
// keeping them distinguishable from 005's b0-prefixed roster in query results).
const localBotUsers = [
    {
        id: 'b1000001-b070-4000-a000-d00000000101',
        botType: 'foodie',
        firstName: 'Nina',
        lastName: 'Kowalski',
        userName: 'ninakowalski',
        settingsBio: 'Chicago. Italian beef purist, deep dish apologist. Will drive 40 minutes for a good taco.',
        locality: 'Chicago, IL',
        latitude: 41.8781,
        longitude: -87.6298,
    },
    {
        id: 'b1000002-b070-4000-a000-d00000000102',
        botType: 'genz',
        firstName: 'Malik',
        lastName: 'Osei',
        userName: 'malikosei',
        settingsBio: 'bushwick. professional g train complainer',
        locality: 'Brooklyn, NY',
        latitude: 40.6782,
        longitude: -73.9442,
    },
    {
        id: 'b1000003-b070-4000-a000-d00000000103',
        botType: 'business',
        firstName: 'Elena',
        lastName: 'Marchetti',
        userName: 'elenamarchetti',
        settingsBio: 'LA. Third career, first one I actually like. Yes I have opinions about the 405.',
        locality: 'Los Angeles, CA',
        latitude: 34.0522,
        longitude: -118.2437,
    },
    {
        id: 'b1000004-b070-4000-a000-d00000000104',
        botType: 'musician',
        firstName: 'Beau',
        lastName: 'Hendricks',
        userName: 'beauhendricks',
        settingsBio: 'Austin. Play out when someone books me, complain about load-in either way.',
        locality: 'Austin, TX',
        latitude: 30.2672,
        longitude: -97.7431,
    },
    {
        id: 'b1000005-b070-4000-a000-d00000000105',
        botType: 'academic',
        firstName: 'Wen',
        lastName: 'Liu',
        userName: 'wenliu',
        settingsBio: 'Seattle. Grad student. The rain is fine. The dark at 4pm is the problem.',
        locality: 'Seattle, WA',
        latitude: 47.6062,
        longitude: -122.3321,
    },
    {
        id: 'b1000006-b070-4000-a000-d00000000106',
        botType: 'outdoors',
        firstName: 'Cody',
        lastName: 'Ferris',
        userName: 'codyferris',
        settingsBio: 'Denver. Trailhead by 6am to beat the I-70 crowd. Sore legs, no regrets.',
        locality: 'Denver, CO',
        latitude: 39.7392,
        longitude: -104.9903,
    },
    {
        id: 'b1000007-b070-4000-a000-d00000000107',
        botType: 'republican',
        firstName: 'Dale',
        lastName: 'Whitfield',
        userName: 'dalewhitfield',
        settingsBio: 'Nashville. Smoker on the porch, game on the radio, meat-and-three on Sundays.',
        locality: 'Nashville, TN',
        latitude: 36.1627,
        longitude: -86.7816,
    },
    {
        id: 'b1000008-b070-4000-a000-d00000000108',
        botType: 'socialhealth',
        firstName: 'Robin',
        lastName: 'Ashford',
        userName: 'robinashford',
        settingsBio: 'Portland. Community garden plot, too many library holds, trying to get my friends outside.',
        locality: 'Portland, OR',
        latitude: 45.5152,
        longitude: -122.6784,
    },
    {
        id: 'b1000009-b070-4000-a000-d00000000109',
        botType: 'traveler',
        firstName: 'Yolanda',
        lastName: 'Castillo',
        userName: 'yolandacastillo',
        settingsBio: 'Miami. Been everywhere, keep coming back. Cafecito is non-negotiable.',
        locality: 'Miami, FL',
        latitude: 25.7617,
        longitude: -80.1918,
    },
    {
        id: 'b100000a-b070-4000-a000-d0000000010a',
        botType: 'millennial',
        firstName: 'Erin',
        lastName: 'Sandoval',
        userName: 'erinsandoval',
        settingsBio: 'Minneapolis. Two kids, one hockey schedule, zero free weekends. Winter is a personality.',
        locality: 'Minneapolis, MN',
        latitude: 44.9778,
        longitude: -93.2650,
    },
    {
        id: 'b100000b-b070-4000-a000-d0000000010b',
        botType: 'hiphop',
        firstName: 'Trey',
        lastName: 'Baldwin',
        userName: 'treybaldwin',
        settingsBio: 'Atlanta. Records, late sets, and a standing Waffle House order.',
        locality: 'Atlanta, GA',
        latitude: 33.7490,
        longitude: -84.3880,
    },
    {
        id: 'b100000c-b070-4000-a000-d0000000010c',
        botType: 'democrat',
        firstName: 'Priscilla',
        lastName: 'Nakamura',
        userName: 'priscillanakamura',
        settingsBio: 'SF. Bike commuter, ballot reader, permanent extra layer for the fog.',
        locality: 'San Francisco, CA',
        latitude: 37.7749,
        longitude: -122.4194,
    },
];

const generateUsers = (hashedPassword) => localBotUsers.map((bot) => ({
    ...bot,
    email: `${bot.userName}@bots.test.local`,
    password: hashedPassword,
    hasAgreedToTerms: true,
    accessLevels: JSON.stringify(['user.default', 'user.verified.email']),
    verificationCodes: JSON.stringify({ email: {}, mobile: {} }),
    brandVariations: JSON.stringify([{ brand: 'therr', details: {} }]),
    settingsIsProfilePublic: true,
    settingsLocale: 'en-us',
    settingsThemeName: 'light',
    loginCount: 0,
    isBlocked: false,
    isBusinessAccount: false,
    isCreatorAccount: false,
    isBot: true,
    isUnclaimed: false,
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
                "isBlocked", "isBusinessAccount", "isCreatorAccount",
                "isBot", "botType", "isUnclaimed"
            )
            VALUES (
                ?::uuid, ?, ?, ?, ?, ?,
                ?, ?::jsonb, ?::jsonb,
                ?::jsonb, ?, ?,
                ?, ?, ?,
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
            user.isBot, user.botType, user.isUnclaimed,
        ])),
    );

    // Home locations. Inserted separately (rather than as part of the user insert) because
    // they live in another table, and re-runnable on their own: a roster seeded before this
    // file existed, or one whose user rows were skipped by the conflict clause above, still
    // ends up with its homes. `latitudeRounded`/`longitudeRounded` are what the table's
    // unique constraint is on, so they are computed the same way UserLocationsStore.create
    // does it (3 decimal places, ~111m) or the conflict clause would not match.
    const locationResults = await Promise.all(
        localBotUsers.map((bot) => knex.raw(`
            INSERT INTO main."userLocations" (
                "userId", "isDeclaredHome", "latitude", "longitude",
                "latitudeRounded", "longitudeRounded", "visitCount"
            )
            VALUES (?::uuid, ?, ?, ?, ?, ?, ?)
            ON CONFLICT ("userId", "latitudeRounded", "longitudeRounded") DO NOTHING
        `, [
            bot.id,
            true,
            bot.latitude,
            bot.longitude,
            Math.round(bot.latitude * 1000) / 1000,
            Math.round(bot.longitude * 1000) / 1000,
            1,
        ]).catch((err) => {
            // A location row whose user was never inserted (foreign key violation) is not a
            // reason to fail the whole seed — the other 11 metros are still valid.
            console.warn(`Skipped home location for ${bot.userName}: ${err.message}`);
            return { rowCount: 0 };
        })),
    );

    const inserted = results.filter((r) => r.rowCount > 0).length;
    const skipped = results.length - inserted;
    const locationsInserted = locationResults.filter((r) => r.rowCount > 0).length;

    console.log(`Local bot users seed complete: ${inserted} inserted, ${skipped} skipped (already exist); `
        + `${locationsInserted} home locations inserted`);
};
