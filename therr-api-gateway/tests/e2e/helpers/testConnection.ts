/**
 * Test connection helpers for E2E tests.
 *
 * Provides a read/write PostgreSQL pool pair pointed at the users-service DB
 * (which stores the campaign referral + achievement rows) and the maps-service
 * DB (spaces, moments, events, incentives). Reuses the same env vars as the
 * existing microservice integration tests.
 *
 * Prerequisites:
 * - docker compose -f docker-compose.infra.yml up -d
 * - Migrations run against both databases
 */
import { Pool } from 'pg';
import path from 'path';

// eslint-disable-next-line @typescript-eslint/no-var-requires
require('dotenv').config({ path: path.join(__dirname, '../../../../.env') });

export interface IE2eConnection {
    users: { read: Pool; write: Pool };
    maps: { read: Pool; write: Pool };
}

const poolBase = {
    max: 5,
    idleTimeoutMillis: 10000,
    connectionTimeoutMillis: 5000,
};

const buildPool = (db: string, mode: 'read' | 'write'): Pool => new Pool({
    ...poolBase,
    host: mode === 'read' ? process.env.DB_HOST_MAIN_READ : process.env.DB_HOST_MAIN_WRITE,
    user: mode === 'read' ? process.env.DB_USER_MAIN_READ : process.env.DB_USER_MAIN_WRITE,
    password: mode === 'read' ? process.env.DB_PASSWORD_MAIN_READ : process.env.DB_PASSWORD_MAIN_WRITE,
    port: Number(mode === 'read' ? process.env.DB_PORT_MAIN_READ : process.env.DB_PORT_MAIN_WRITE),
    database: db,
});

let connection: IE2eConnection | null = null;

export const getE2eConnection = (): IE2eConnection => {
    if (!connection) {
        const usersDb = process.env.USERS_SERVICE_DATABASE || 'therr_dev_users';
        const mapsDb = process.env.MAPS_SERVICE_DATABASE || 'therr_dev_maps';
        connection = {
            users: { read: buildPool(usersDb, 'read'), write: buildPool(usersDb, 'write') },
            maps: { read: buildPool(mapsDb, 'read'), write: buildPool(mapsDb, 'write') },
        };
    }
    return connection;
};

export const closeE2eConnection = async (): Promise<void> => {
    if (!connection) return;
    await Promise.all([
        connection.users.read.end(),
        connection.users.write.end(),
        connection.maps.read.end(),
        connection.maps.write.end(),
    ]);
    connection = null;
};

export const checkE2eConnection = async (): Promise<boolean> => {
    try {
        const conn = getE2eConnection();
        const [u, m] = await Promise.all([
            conn.users.read.query('SELECT 1 as connected'),
            conn.maps.read.query('SELECT 1 as connected'),
        ]);
        return u.rows[0]?.connected === 1 && m.rows[0]?.connected === 1;
    } catch (err) {
        return false;
    }
};

/**
 * Delete rows matching a simple equality condition. Used in after-hooks to
 * remove campaign fixture data from integration runs.
 */
export const deleteRows = async (
    pool: Pool,
    schemaTable: string,
    where: Record<string, unknown>,
): Promise<void> => {
    const keys = Object.keys(where);
    if (keys.length === 0) return;
    const values = Object.values(where);
    const conditions = keys.map((k, i) => `"${k}" = $${i + 1}`).join(' AND ');
    await pool.query(`DELETE FROM ${schemaTable} WHERE ${conditions}`, values);
};
