/**
 * Seed file for Friends with Habits (HABITS app) dev data.
 * Run with: npm run seeds:run (from users-service directory) — runs after 003_dev_users.
 *
 * Generates a believable demo state for the HABITS app:
 *   - Enrolls dev users alice..hannah (the first 8 from 003_dev_users) into the HABITS brand
 *   - Creates 6 system-template habit goals (browse / "discover" surface)
 *   - Creates 4 user-created habit goals
 *   - Creates 4 pacts (3 active, 1 pending invite) pairing different users
 *   - Creates pact_members rows for each pact participant
 *   - Backfills 14 days of habit_checkins with realistic completion patterns
 *   - Maintains streaks rows derived from those checkins
 *
 * Idempotent: predictable UUIDs + ON CONFLICT DO NOTHING throughout, so re-running
 * adds only new dates and never duplicates rows.
 *
 * Dev-only. Do not run in production — the user IDs come from 003_dev_users which
 * is also dev-only.
 */

const HABITS_BRAND = 'habits';

// Dev users a0000001..a0000008 from 003_dev_users.js — alice through hannah.
const HABITS_USER_IDS = [
    'a0000001-de00-4000-a000-d00000000001', // alice
    'a0000002-de00-4000-a000-d00000000002', // bob
    'a0000003-de00-4000-a000-d00000000003', // charlie
    'a0000004-de00-4000-a000-d00000000004', // diana
    'a0000005-de00-4000-a000-d00000000005', // ethan
    'a0000006-de00-4000-a000-d00000000006', // fiona
    'a0000007-de00-4000-a000-d00000000007', // george
    'a0000008-de00-4000-a000-d00000000008', // hannah
];

const TEMPLATE_GOALS = [
    {
        id: 'b0000001-de00-4000-a000-000000000001',
        name: 'Morning workout',
        description: '20-minute movement session before 9am',
        category: 'fitness',
        emoji: '🏋️',
    },
    {
        id: 'b0000002-de00-4000-a000-000000000002',
        name: 'Read 15 minutes',
        description: 'Read a book (no phone) for 15 minutes daily',
        category: 'learning',
        emoji: '📚',
    },
    {
        id: 'b0000003-de00-4000-a000-000000000003',
        name: 'Meditation',
        description: '10 minutes of guided or silent meditation',
        category: 'mindfulness',
        emoji: '🧘',
    },
    {
        id: 'b0000004-de00-4000-a000-000000000004',
        name: 'Drink 64oz water',
        description: 'Hit your hydration target by end of day',
        category: 'health',
        emoji: '💧',
    },
    {
        id: 'b0000005-de00-4000-a000-000000000005',
        name: 'Daily journal',
        description: '3 sentences: what went well, what didn\'t, what\'s next',
        category: 'mindfulness',
        emoji: '📓',
    },
    {
        id: 'b0000006-de00-4000-a000-000000000006',
        name: 'No phone first hour',
        description: 'No phone for the first hour after waking',
        category: 'productivity',
        emoji: '📵',
    },
];

const USER_GOALS = [
    {
        id: 'b0000101-de00-4000-a000-000000000101',
        createdByUserId: HABITS_USER_IDS[0], // alice
        name: 'Pull-ups',
        description: 'Work up to 10 unbroken pull-ups',
        category: 'fitness',
        emoji: '💪',
    },
    {
        id: 'b0000102-de00-4000-a000-000000000102',
        createdByUserId: HABITS_USER_IDS[2], // charlie
        name: 'Spanish lesson',
        description: '15 minutes on Duolingo',
        category: 'learning',
        emoji: '🇪🇸',
    },
    {
        id: 'b0000103-de00-4000-a000-000000000103',
        createdByUserId: HABITS_USER_IDS[4], // ethan
        name: 'Stretching',
        description: '5 minutes of mobility work',
        category: 'health',
        emoji: '🤸',
    },
    {
        id: 'b0000104-de00-4000-a000-000000000104',
        createdByUserId: HABITS_USER_IDS[6], // george
        name: 'Sketch a thing',
        description: 'One sketch per day, any subject, any quality',
        category: 'creative',
        emoji: '✏️',
    },
];

// Pacts: pair users on a goal. status='active' means both have joined.
const PACTS = [
    {
        id: 'c0000001-de00-4000-a000-000000000001',
        creatorUserId: HABITS_USER_IDS[0], // alice
        partnerUserId: HABITS_USER_IDS[1], // bob
        habitGoalId: TEMPLATE_GOALS[0].id, // morning workout
        status: 'active',
        durationDays: 30,
        daysAgoStart: 12,
    },
    {
        id: 'c0000002-de00-4000-a000-000000000002',
        creatorUserId: HABITS_USER_IDS[2], // charlie
        partnerUserId: HABITS_USER_IDS[3], // diana
        habitGoalId: TEMPLATE_GOALS[1].id, // read 15 min
        status: 'active',
        durationDays: 30,
        daysAgoStart: 7,
    },
    {
        id: 'c0000003-de00-4000-a000-000000000003',
        creatorUserId: HABITS_USER_IDS[4], // ethan
        partnerUserId: HABITS_USER_IDS[5], // fiona
        habitGoalId: TEMPLATE_GOALS[2].id, // meditation
        status: 'active',
        durationDays: 14,
        daysAgoStart: 5,
    },
    {
        id: 'c0000004-de00-4000-a000-000000000004',
        creatorUserId: HABITS_USER_IDS[6], // george (waiting on hannah)
        partnerUserId: HABITS_USER_IDS[7], // hannah
        habitGoalId: TEMPLATE_GOALS[3].id, // water
        status: 'pending',
        durationDays: 7,
        daysAgoStart: null,
    },
];

// Per-pact-member: how often the user successfully checks in (0..1).
// Generates a believable mix of streaks — alice/bob both consistent, diana spotty, ethan strong.
const MEMBER_COMPLETION_RATES = {
    [HABITS_USER_IDS[0]]: 0.92, // alice
    [HABITS_USER_IDS[1]]: 0.85, // bob
    [HABITS_USER_IDS[2]]: 0.78, // charlie
    [HABITS_USER_IDS[3]]: 0.55, // diana — spotty
    [HABITS_USER_IDS[4]]: 0.95, // ethan — strong
    [HABITS_USER_IDS[5]]: 0.70, // fiona
};

// Deterministic pseudo-random via DJB2-style hash so re-runs produce stable completion patterns
// per (user, date) pair. Avoids bitwise ops to satisfy lint; modulo prevents overflow drift.
const MOD = 2147483647;
const isCompleted = (userId, dateIso, rate) => {
    const seedStr = `${userId}|${dateIso}`;
    let hash = 5381;
    for (let i = 0; i < seedStr.length; i += 1) {
        hash = (hash * 33 + seedStr.charCodeAt(i)) % MOD;
    }
    return (hash / MOD) < rate;
};

const daysAgoIso = (n) => {
    const d = new Date();
    d.setUTCHours(0, 0, 0, 0);
    d.setUTCDate(d.getUTCDate() - n);
    return d.toISOString().slice(0, 10); // YYYY-MM-DD
};

const range = (n) => Array.from({ length: n }, (_, i) => i);

const enrollUsersInHabits = async (knex) => {
    // Reuses the same JSONB upsert pattern as UsersStore.upsertBrandVariation so the canonical
    // {brand, firstSeenAt, lastSeenAt, isActive} shape is consistent with what login produces.
    const results = await Promise.all(HABITS_USER_IDS.map((userId) => knex.raw(`
        UPDATE main.users SET "brandVariations" = (
            CASE WHEN EXISTS (
                SELECT 1 FROM jsonb_array_elements("brandVariations") AS elem
                WHERE elem->>'brand' = ?
            )
            THEN "brandVariations"
            ELSE "brandVariations" || jsonb_build_array(
                jsonb_build_object(
                    'brand', ?::text,
                    'firstSeenAt', now()::text,
                    'lastSeenAt', now()::text,
                    'isActive', true
                )
            )
            END
        )
        WHERE id = ?::uuid
    `, [HABITS_BRAND, HABITS_BRAND, userId])));
    return results.filter((r) => r.rowCount > 0).length;
};

const insertHabitGoals = async (knex) => {
    const all = [
        ...TEMPLATE_GOALS.map((g) => ({
            ...g, createdByUserId: HABITS_USER_IDS[0], isTemplate: true, isPublic: true,
        })),
        ...USER_GOALS.map((g) => ({ ...g, isTemplate: false, isPublic: false })),
    ];
    const results = await Promise.all(all.map((goal) => knex.raw(`
        INSERT INTO habits.habit_goals (
            id, name, description, category, emoji,
            "frequencyType", "frequencyCount",
            "createdByUserId", "isTemplate", "isPublic"
        ) VALUES (
            ?::uuid, ?, ?, ?, ?,
            'daily', 1,
            ?::uuid, ?, ?
        ) ON CONFLICT (id) DO NOTHING
    `, [
        goal.id, goal.name, goal.description, goal.category, goal.emoji,
        goal.createdByUserId, goal.isTemplate, goal.isPublic,
    ])));
    return results.filter((r) => r.rowCount > 0).length;
};

const insertPacts = async (knex) => {
    const results = await Promise.all(PACTS.map((pact) => {
        const startDate = pact.daysAgoStart != null ? daysAgoIso(pact.daysAgoStart) : null;
        const endDate = startDate ? daysAgoIso(pact.daysAgoStart - pact.durationDays) : null;
        return knex.raw(`
            INSERT INTO habits.pacts (
                id, "creatorUserId", "partnerUserId", "habitGoalId",
                "pactType", status, "durationDays", "startDate", "endDate"
            ) VALUES (
                ?::uuid, ?::uuid, ?::uuid, ?::uuid,
                'accountability', ?, ?, ?::timestamptz, ?::timestamptz
            ) ON CONFLICT (id) DO NOTHING
        `, [
            pact.id, pact.creatorUserId, pact.partnerUserId, pact.habitGoalId,
            pact.status, pact.durationDays, startDate, endDate,
        ]);
    }));
    return results.filter((r) => r.rowCount > 0).length;
};

const insertPactMembers = async (knex) => {
    const memberRows = PACTS.flatMap((pact) => [
        { pact, userId: pact.creatorUserId, role: 'creator' },
        { pact, userId: pact.partnerUserId, role: 'partner' },
    ].filter((m) => m.userId));

    const results = await Promise.all(memberRows.map(({ pact, userId, role }) => {
        const status = pact.status === 'pending' && role === 'partner' ? 'pending' : 'active';
        const joinedAt = status === 'active' && pact.daysAgoStart != null ? daysAgoIso(pact.daysAgoStart) : null;
        return knex.raw(`
            INSERT INTO habits.pact_members (
                "pactId", "userId", role, status,
                "joinedAt", "celebratePartnerCheckins"
            ) VALUES (
                ?::uuid, ?::uuid, ?, ?,
                ?::timestamptz, true
            ) ON CONFLICT ("pactId", "userId") DO NOTHING
        `, [pact.id, userId, role, status, joinedAt]);
    }));
    return results.filter((r) => r.rowCount > 0).length;
};

// Walk dates oldest -> newest computing streak state. Pure / no I/O so safe to run synchronously.
const buildPactUserPlan = (pact, userId) => {
    const rate = MEMBER_COMPLETION_RATES[userId] ?? 0.7;
    const dates = range(pact.daysAgoStart + 1)
        .map((i) => pact.daysAgoStart - i) // oldest first
        .map((n) => {
            const dateIso = daysAgoIso(n);
            return { dateIso, completed: isCompleted(userId, dateIso, rate) };
        });
    const initial = {
        currentStreak: 0,
        runStart: null,
        lastCompletedDate: null,
        longestStreak: 0,
        longestStart: null,
        longestEnd: null,
    };
    const state = dates.reduce((acc, { dateIso, completed }) => {
        if (!completed) return { ...acc, currentStreak: 0, runStart: null };
        const newCurrent = acc.currentStreak + 1;
        const newRunStart = acc.runStart || dateIso;
        const isNewRecord = newCurrent > acc.longestStreak;
        return {
            currentStreak: newCurrent,
            runStart: newRunStart,
            lastCompletedDate: dateIso,
            longestStreak: isNewRecord ? newCurrent : acc.longestStreak,
            longestStart: isNewRecord ? newRunStart : acc.longestStart,
            longestEnd: isNewRecord ? dateIso : acc.longestEnd,
        };
    }, initial);
    return { dates, state };
};

const insertCheckinsAndStreaks = async (knex) => {
    const activePacts = PACTS.filter((p) => p.status === 'active' && p.daysAgoStart != null);
    const plans = activePacts.flatMap((pact) => [pact.creatorUserId, pact.partnerUserId]
        .filter(Boolean)
        .map((userId) => ({ pact, userId, ...buildPactUserPlan(pact, userId) })));

    const checkinResults = await Promise.all(plans.flatMap(({ pact, userId, dates }) => dates.map(({ dateIso, completed }) => knex.raw(`
        INSERT INTO habits.habit_checkins (
            "userId", "pactId", "habitGoalId", "scheduledDate",
            "completedAt", status, "contributedToStreak"
        ) VALUES (
            ?::uuid, ?::uuid, ?::uuid, ?::date,
            ?, ?, ?
        ) ON CONFLICT ("userId", "habitGoalId", "scheduledDate") DO NOTHING
    `, [
        userId, pact.id, pact.habitGoalId, dateIso,
        completed ? `${dateIso}T15:00:00Z` : null,
        completed ? 'completed' : 'missed',
        completed,
    ]))));

    const streakResults = await Promise.all(plans.map(({ pact, userId, state }) => knex.raw(`
        INSERT INTO habits.streaks (
            "userId", "habitGoalId", "pactId",
            "currentStreak", "currentStreakStartDate", "lastCompletedDate",
            "longestStreak", "longestStreakStartDate", "longestStreakEndDate",
            "isActive"
        ) VALUES (
            ?::uuid, ?::uuid, ?::uuid,
            ?, ?::date, ?::date,
            ?, ?::date, ?::date,
            true
        ) ON CONFLICT ("userId", "habitGoalId") DO UPDATE SET
            "currentStreak" = EXCLUDED."currentStreak",
            "currentStreakStartDate" = EXCLUDED."currentStreakStartDate",
            "lastCompletedDate" = EXCLUDED."lastCompletedDate",
            "longestStreak" = GREATEST(habits.streaks."longestStreak", EXCLUDED."longestStreak"),
            "longestStreakStartDate" = CASE
                WHEN EXCLUDED."longestStreak" > habits.streaks."longestStreak"
                THEN EXCLUDED."longestStreakStartDate"
                ELSE habits.streaks."longestStreakStartDate"
            END,
            "longestStreakEndDate" = CASE
                WHEN EXCLUDED."longestStreak" > habits.streaks."longestStreak"
                THEN EXCLUDED."longestStreakEndDate"
                ELSE habits.streaks."longestStreakEndDate"
            END,
            "updatedAt" = now()
    `, [
        userId, pact.habitGoalId, pact.id,
        state.currentStreak, state.currentStreak > 0 ? state.runStart : null, state.lastCompletedDate,
        state.longestStreak, state.longestStart, state.longestEnd,
    ])));

    return {
        checkinsInserted: checkinResults.filter((r) => r.rowCount > 0).length,
        streaksTouched: streakResults.filter((r) => r.rowCount > 0).length,
    };
};

exports.seed = async (knex) => {
    const enrolled = await enrollUsersInHabits(knex);
    const goalsInserted = await insertHabitGoals(knex);
    const pactsInserted = await insertPacts(knex);
    const membersInserted = await insertPactMembers(knex);
    const { checkinsInserted, streaksTouched } = await insertCheckinsAndStreaks(knex);

    console.log('HABITS dev seed complete:');
    console.log(`  - users enrolled in HABITS brand: ${enrolled} (idempotent; re-runs add only new entries)`);
    console.log(`  - habit_goals inserted: ${goalsInserted} (${TEMPLATE_GOALS.length} templates + ${USER_GOALS.length} user-created)`);
    console.log(`  - pacts inserted: ${pactsInserted}`);
    console.log(`  - pact_members inserted: ${membersInserted}`);
    console.log(`  - habit_checkins inserted: ${checkinsInserted} (today + back-fill, deterministic per user)`);
    console.log(`  - streaks rows touched: ${streaksTouched}`);
    console.log('Login as alice.anderson@test.local / TestPass123! to see HABITS data.');
};
