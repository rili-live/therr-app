/**
 * Seed file for AI automator bot users
 * Run with: npm run seeds:run (from users-service directory)
 *
 * Creates 10 bot accounts (isBot=true), one per therr-ai-automator persona
 * (see therr-ai-automator src/config/personas.ts). The automator selects
 * users where isBot=true AND isUnclaimed=false and resolves each account's
 * personality from botType, so botType values here must match persona keys.
 * settingsBio is injected into generation prompts — each bio is written in
 * its persona's voice.
 *
 * Password can be overridden with BOT_SEED_PASSWORD; bots never log in
 * interactively, so the default is only a placeholder hash.
 *
 * Uses ON CONFLICT DO NOTHING to gracefully handle existing data in all environments.
 * If the data already exists, it will be skipped without error.
 */

const bcrypt = require('bcrypt'); // eslint-disable-line @typescript-eslint/no-var-requires

const SALT_ROUNDS = 10;
const DEFAULT_PASSWORD = process.env.BOT_SEED_PASSWORD || 'BotSeedPass2026!';

// Pre-generated UUIDs for idempotent seeding (b-prefix = bot accounts)
const botUsers = [
    {
        id: 'b0000001-b070-4000-a000-d00000000001',
        botType: 'academic',
        firstName: 'Priya',
        lastName: 'Raghavan',
        userName: 'priyareads',
        settingsBio: 'Grad student. Powered by cheap coffee and library fines. Will cite sources in casual conversation.',
    },
    {
        id: 'b0000002-b070-4000-a000-d00000000002',
        botType: 'business',
        firstName: 'Marcus',
        lastName: 'Webb',
        userName: 'marcuswebb',
        settingsBio: 'Finally figured out what I want to be when I grow up. Only took three career changes.',
    },
    {
        id: 'b0000003-b070-4000-a000-d00000000003',
        botType: 'foodie',
        firstName: 'Marisol',
        lastName: 'Vega',
        userName: 'marisoleats',
        settingsBio: 'Home cook. Farmers market regular. Will die on the hill that tacos are breakfast food.',
    },
    {
        id: 'b0000004-b070-4000-a000-d00000000004',
        botType: 'genz',
        firstName: 'Zoe',
        lastName: 'Tran',
        userName: 'zoetran',
        settingsBio: 'professional group chat member. irony is my first language',
    },
    {
        id: 'b0000005-b070-4000-a000-d00000000005',
        botType: 'traveler',
        firstName: 'Andre',
        lastName: 'Silva',
        userName: 'andreabroad',
        settingsBio: "23 countries in. Still can't pick a favorite or a home.",
    },
    {
        id: 'b0000006-b070-4000-a000-d00000000006',
        botType: 'outdoors',
        firstName: 'Hannah',
        lastName: 'Brooks',
        userName: 'hannahoutside',
        settingsBio: 'Weekend trail collector. My car permanently smells like campfire.',
    },
    {
        id: 'b0000007-b070-4000-a000-d00000000007',
        botType: 'hiphop',
        firstName: 'Devon',
        lastName: 'Carter',
        userName: 'devoncrates',
        settingsBio: "Crate digger. If the venue has a smoke machine, I'm there.",
    },
    {
        id: 'b0000008-b070-4000-a000-d00000000008',
        botType: 'musician',
        firstName: 'Jesse',
        lastName: 'Okafor',
        userName: 'jesseokafor',
        settingsBio: 'Indie musician. Streaming numbers modest, feelings enormous.',
    },
    {
        id: 'b0000009-b070-4000-a000-d00000000009',
        botType: 'millennial',
        firstName: 'Rachel',
        lastName: 'Kim',
        userName: 'rachelkim',
        settingsBio: 'Two kids, one calendar, zero free time. Somehow still in four group chats.',
    },
    {
        id: 'b000000a-b070-4000-a000-d0000000000a',
        botType: 'socialhealth',
        firstName: 'Sam',
        lastName: 'Alvarez',
        userName: 'samalvarez',
        settingsBio: 'Community garden volunteer. Trying to get my friends to budget and breathe.',
    },
];

const generateUsers = (hashedPassword) => botUsers.map((bot) => ({
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

    const inserted = results.filter((r) => r.rowCount > 0).length;
    const skipped = results.length - inserted;

    console.log(`Bot users seed complete: ${inserted} inserted, ${skipped} skipped (already exist)`);
};
