/**
 * Campaign fixture helpers.
 *
 * Builds the DB state needed by each campaign flow (referral, QR check-in,
 * Space Incentive, Event, Moment proximity, Achievement, Onboarding) and
 * provides cleanup helpers to remove that state between tests.
 *
 * Intentionally uses direct Knex SQL rather than the service-level Store
 * classes. That avoids cascading imports (AWS SDK, content-safety utilities,
 * etc.) that are not relevant to the campaign and would require extra env
 * setup in CI. The tests still exercise the real schema + constraints the
 * handlers depend on, which is where campaign-blocking regressions hide.
 */
import KnexBuilder, { Knex } from 'knex';
import bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';
import { getE2eConnection, deleteRows } from './testConnection';

const knex: Knex = KnexBuilder({ client: 'pg' });

export const TEST_EMAIL_DOMAIN = '@campaign-e2e-test.com';
export const TEST_EMAIL_PREFIX = 'campaign-e2e-';

export interface ITestUser {
    id: string;
    email: string;
    userName: string;
    firstName: string;
    settingsTherrCoinTotal: number;
}

export interface ITestSpace {
    id: string;
    addressReadable: string;
    latitude: number;
    longitude: number;
    fromUserId: string;
}

export interface ITestMoment {
    id: string;
    fromUserId: string;
    latitude: number;
    longitude: number;
    radius: number;
}

export interface ITestEvent {
    id: string;
    fromUserId: string;
    scheduleStartAt: Date;
    scheduleStopAt: Date;
    latitude: number;
    longitude: number;
}

/**
 * Seed a user in the main.users table. Returns the created row.
 */
export const createTestUser = async (overrides: Partial<ITestUser> = {}): Promise<ITestUser> => {
    const conn = getE2eConnection();
    const id = randomUUID();
    const suffix = id.slice(0, 8);
    const email = overrides.email ?? `${TEST_EMAIL_PREFIX}${suffix}${TEST_EMAIL_DOMAIN}`;
    const userName = overrides.userName ?? `campaigne2e${suffix.replace(/-/g, '')}`;
    const firstName = overrides.firstName ?? 'CampaignTest';
    const hashedPassword = await bcrypt.hash('TestPassword123!', 4);

    const sql = knex.insert({
        id,
        email,
        userName,
        firstName,
        lastName: 'E2E',
        password: hashedPassword,
        hasAgreedToTerms: true,
        accessLevels: JSON.stringify(['user.default']),
        verificationCodes: JSON.stringify({ email: {} }),
        settingsTherrCoinTotal: overrides.settingsTherrCoinTotal ?? 0,
    })
        .into('main.users')
        .returning('*')
        .toString();

    const result = await conn.users.write.query(sql);
    return result.rows[0] as ITestUser;
};

/**
 * Seed a Space row in main.spaces with the PostGIS shape SpacesStore.create writes.
 */
export const createTestSpace = async (
    fromUserId: string,
    overrides: Partial<ITestSpace> = {},
): Promise<ITestSpace> => {
    const conn = getE2eConnection();
    const id = randomUUID();
    const latitude = overrides.latitude ?? 39.7684;
    const longitude = overrides.longitude ?? -86.1581;
    const addressReadable = overrides.addressReadable ?? `Campaign E2E Space ${id.slice(0, 8)}`;

    // PostGIS columns must match what SpacesStore.create writes, not just "a point":
    // `main.spaces.geom` is geometry(Polygon,4326) — a radius buffer, not a point — and
    // proximity reads go through `geomCenter` (geometry(Point,4326)), so a row without it
    // is invisible to every space query. Kept minimal otherwise; tests that need richer
    // space data should insert additional columns explicitly.
    const sql = `
        INSERT INTO main.spaces (
            id, "fromUserId", "addressReadable", latitude, longitude, geom, "geomCenter",
            "notificationMsg", region, "isPublic", radius, category
        )
        VALUES (
            $1, $2, $3, $4, $5,
            ST_SetSRID(ST_Buffer(ST_MakePoint($5, $4)::geography, 25)::geometry, 4326),
            ST_SetSRID(ST_MakePoint($5, $4), 4326),
            'campaign e2e space', 'us', true, 25, 'uncategorized'
        )
        RETURNING id, "fromUserId", "addressReadable", latitude, longitude;
    `;
    const result = await conn.maps.write.query(sql, [id, fromUserId, addressReadable, latitude, longitude]);
    return result.rows[0];
};

/**
 * Seed a Moment row in main.moments with a PostGIS point.
 *
 * `geom` is geometry(Point,4326) — matching MomentsStore, which writes
 * `ST_SetSRID(ST_MakePoint(lon, lat), 4326)` and casts to geography only at read time
 * so ST_DWithin's distance is in metres. Writing a geography here is a type error.
 */
export const createTestMoment = async (
    fromUserId: string,
    overrides: Partial<ITestMoment> = {},
): Promise<ITestMoment> => {
    const conn = getE2eConnection();
    const id = randomUUID();
    const latitude = overrides.latitude ?? 39.7684;
    const longitude = overrides.longitude ?? -86.1581;
    const radius = overrides.radius ?? 50;

    const sql = `
        INSERT INTO main.moments (
            id, "fromUserId", latitude, longitude, radius, geom,
            "notificationMsg", region, "isPublic", category, message
        )
        VALUES (
            $1, $2, $3, $4, $5, ST_SetSRID(ST_MakePoint($4, $3), 4326),
            'campaign e2e moment', 'us', true, 'uncategorized', 'campaign e2e moment'
        )
        RETURNING id, "fromUserId", latitude, longitude, radius;
    `;
    const result = await conn.maps.write.query(sql, [id, fromUserId, latitude, longitude, radius]);
    return result.rows[0];
};

/**
 * Seed an Event row in main.events.
 */
export const createTestEvent = async (
    fromUserId: string,
    overrides: Partial<ITestEvent> = {},
): Promise<ITestEvent> => {
    const conn = getE2eConnection();
    const id = randomUUID();
    const latitude = overrides.latitude ?? 39.7684;
    const longitude = overrides.longitude ?? -86.1581;
    const scheduleStartAt = overrides.scheduleStartAt ?? new Date(Date.now() + 24 * 60 * 60 * 1000);
    const scheduleStopAt = overrides.scheduleStopAt ?? new Date(Date.now() + 26 * 60 * 60 * 1000);

    const sql = `
        INSERT INTO main.events (
            id, "fromUserId", "groupId", latitude, longitude, geom, "scheduleStartAt", "scheduleStopAt",
            "notificationMsg", region, "isPublic", category, message, radius
        )
        VALUES (
            $1, $2, $7, $3, $4, ST_SetSRID(ST_MakePoint($4, $3), 4326), $5, $6,
            'campaign e2e event', 'us', true, 'uncategorized', 'campaign e2e event', 50
        )
        RETURNING id, "fromUserId", latitude, longitude, "scheduleStartAt", "scheduleStopAt";
    `;
    // `groupId` is NOT NULL with no FK — an event belongs to a group in production, and the
    // campaign flows never read it, so a standalone uuid per fixture keeps rows independent.
    const result = await conn.maps.write.query(
        sql,
        [id, fromUserId, latitude, longitude, scheduleStartAt, scheduleStopAt, randomUUID()],
    );
    return result.rows[0];
};

/**
 * Remove all campaign fixture rows created during a test run.
 * Call from after() hooks. Safe to call when no rows exist.
 */
export const cleanupTestUsers = async (userIds: string[]): Promise<void> => {
    if (!userIds.length) return;
    const conn = getE2eConnection();
    // Delete dependent rows first to avoid FK violations.
    const placeholders = userIds.map((_, i) => `$${i + 1}`).join(',');
    await conn.users.write.query(
        `DELETE FROM "main"."userAchievements" WHERE "userId" IN (${placeholders})`,
        userIds,
    );
    await conn.users.write.query(
        `DELETE FROM "main"."users" WHERE id IN (${placeholders})`,
        userIds,
    );
};

export const cleanupTestSpaces = async (spaceIds: string[]): Promise<void> => {
    if (!spaceIds.length) return;
    const conn = getE2eConnection();
    const placeholders = spaceIds.map((_, i) => `$${i + 1}`).join(',');
    // Cascade through incentives/coupons first.
    await conn.maps.write.query(
        `DELETE FROM "main"."spaceIncentiveCoupons" WHERE "spaceIncentiveId" IN (
             SELECT id FROM "main"."spaceIncentives" WHERE "spaceId" IN (${placeholders})
         )`,
        spaceIds,
    );
    await conn.maps.write.query(
        `DELETE FROM "main"."spaceIncentives" WHERE "spaceId" IN (${placeholders})`,
        spaceIds,
    );
    await conn.maps.write.query(
        `DELETE FROM "main"."spaces" WHERE id IN (${placeholders})`,
        spaceIds,
    );
};

export const cleanupTestMoments = async (momentIds: string[]): Promise<void> => {
    if (!momentIds.length) return;
    const conn = getE2eConnection();
    const placeholders = momentIds.map((_, i) => `$${i + 1}`).join(',');
    await conn.maps.write.query(
        `DELETE FROM "main"."moments" WHERE id IN (${placeholders})`,
        momentIds,
    );
};

export const cleanupTestEvents = async (eventIds: string[]): Promise<void> => {
    if (!eventIds.length) return;
    const conn = getE2eConnection();
    const placeholders = eventIds.map((_, i) => `$${i + 1}`).join(',');
    await conn.maps.write.query(
        `DELETE FROM "main"."events" WHERE id IN (${placeholders})`,
        eventIds,
    );
};

/**
 * Get a user by id. Use to verify reward payouts / state changes.
 */
export const getUserById = async (userId: string): Promise<any> => {
    const conn = getE2eConnection();
    const result = await conn.users.read.query(
        'SELECT * FROM "main"."users" WHERE id = $1',
        [userId],
    );
    return result.rows[0];
};

/**
 * Execute an arbitrary SQL query against one of the campaign DBs. Used by
 * tests that need assertions beyond the helpers above.
 */
export const queryUsersDb = async (sql: string, params: any[] = []): Promise<any[]> => {
    const conn = getE2eConnection();
    const result = await conn.users.read.query(sql, params);
    return result.rows;
};

export const queryMapsDb = async (sql: string, params: any[] = []): Promise<any[]> => {
    const conn = getE2eConnection();
    const result = await conn.maps.read.query(sql, params);
    return result.rows;
};

export const execUsersDb = async (sql: string, params: any[] = []): Promise<any[]> => {
    const conn = getE2eConnection();
    const result = await conn.users.write.query(sql, params);
    return result.rows;
};

export const execMapsDb = async (sql: string, params: any[] = []): Promise<any[]> => {
    const conn = getE2eConnection();
    const result = await conn.maps.write.query(sql, params);
    return result.rows;
};

// Re-export for convenience
export { deleteRows };
