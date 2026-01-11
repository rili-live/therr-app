/**
 * Test Database Connection
 *
 * This module provides a real database connection for integration tests.
 * It uses the same environment configuration as the main application.
 *
 * Prerequisites:
 * - Docker infrastructure must be running: docker compose -f docker-compose.infra.yml up -d
 * - Migrations must be run: npm run migrations:run
 */
import { Pool } from 'pg';
import path from 'path';

// Load environment variables from root .env file
// eslint-disable-next-line @typescript-eslint/no-var-requires
require('dotenv').config({ path: path.join(__dirname, '../../../../.env') });

export interface ITestConnection {
    read: Pool;
    write: Pool;
}

// Create connection pools for testing
const createTestConnection = (): ITestConnection => {
    const poolConfig = {
        host: process.env.DB_HOST_MAIN_READ,
        user: process.env.DB_USER_MAIN_READ,
        password: process.env.DB_PASSWORD_MAIN_READ,
        database: process.env.REACTIONS_SERVICE_DATABASE,
        port: Number(process.env.DB_PORT_MAIN_READ),
        max: 5,
        idleTimeoutMillis: 10000,
        connectionTimeoutMillis: 5000,
    };

    const read = new Pool(poolConfig);
    const write = new Pool({
        ...poolConfig,
        host: process.env.DB_HOST_MAIN_WRITE,
        user: process.env.DB_USER_MAIN_WRITE,
        password: process.env.DB_PASSWORD_MAIN_WRITE,
        port: Number(process.env.DB_PORT_MAIN_WRITE),
    });

    return { read, write };
};

let testConnection: ITestConnection | null = null;

/**
 * Get the test database connection.
 * Creates a new connection if one doesn't exist.
 */
export const getTestConnection = (): ITestConnection => {
    if (!testConnection) {
        testConnection = createTestConnection();
    }
    return testConnection;
};

/**
 * Close the test database connection.
 * Should be called after all tests complete.
 */
export const closeTestConnection = async (): Promise<void> => {
    if (testConnection) {
        await testConnection.read.end();
        await testConnection.write.end();
        testConnection = null;
    }
};

/**
 * Check if the database connection is healthy.
 */
export const checkConnection = async (): Promise<boolean> => {
    try {
        const conn = getTestConnection();
        const result = await conn.read.query('SELECT 1 as connected');
        return result.rows[0]?.connected === 1;
    } catch (error) {
        return false;
    }
};

/**
 * Clean up test data from the database.
 * Use this to reset state between tests.
 */
export const cleanupTestData = async (tableName: string, where: Record<string, unknown>): Promise<void> => {
    const conn = getTestConnection();
    const keys = Object.keys(where);
    const values = Object.values(where);
    const conditions = keys.map((key, idx) => `"${key}" = $${idx + 1}`).join(' AND ');

    await conn.write.query(
        `DELETE FROM "main"."${tableName}" WHERE ${conditions}`,
        values,
    );
};
