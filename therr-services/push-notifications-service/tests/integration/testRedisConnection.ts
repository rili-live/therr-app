/**
 * Test Redis Connection
 *
 * This module provides a real Redis connection for integration tests.
 * It uses the same environment configuration as the main application.
 *
 * Prerequisites:
 * - Docker infrastructure must be running: docker compose -f docker-compose.infra.yml up -d
 */
import Redis from 'ioredis';
import path from 'path';

// Load environment variables from root .env file
// eslint-disable-next-line @typescript-eslint/no-var-requires
require('dotenv').config({ path: path.join(__dirname, '../../../../.env') });

const TEST_KEY_PREFIX = 'push-notifications-service:test:';

type RedisClient = InstanceType<typeof Redis>;

let testRedisClient: RedisClient | null = null;

/**
 * Create a Redis client for testing
 */
const createTestRedisClient = (): RedisClient => new Redis({
    host: process.env.REDIS_GENERIC_HOST,
    port: Number(process.env.REDIS_GENERIC_PORT),
    keyPrefix: TEST_KEY_PREFIX,
    lazyConnect: true,
});

/**
 * Get the test Redis connection.
 * Creates a new connection if one doesn't exist.
 */
export const getTestRedisClient = (): RedisClient => {
    if (!testRedisClient) {
        testRedisClient = createTestRedisClient();
    }
    return testRedisClient;
};

/**
 * Connect to Redis
 */
export const connectRedis = async (): Promise<void> => {
    const client = getTestRedisClient();
    await client.connect();
};

/**
 * Close the test Redis connection.
 * Should be called after all tests complete.
 */
export const closeTestRedisConnection = async (): Promise<void> => {
    if (testRedisClient) {
        await testRedisClient.quit();
        testRedisClient = null;
    }
};

/**
 * Check if the Redis connection is healthy.
 */
export const checkRedisConnection = async (): Promise<boolean> => {
    try {
        const client = getTestRedisClient();
        await client.connect();
        const result = await client.ping();
        return result === 'PONG';
    } catch (error) {
        return false;
    }
};

/**
 * Clean up test data from Redis.
 * Use this to reset state between tests.
 */
export const cleanupTestData = async (pattern: string): Promise<void> => {
    const client = getTestRedisClient();
    // Note: keyPrefix is automatically added by ioredis
    const keys = await client.keys(`${pattern}*`);
    if (keys.length > 0) {
        // Remove the prefix that was added when getting keys
        const keysWithoutPrefix = keys.map((key) => key.replace(TEST_KEY_PREFIX, ''));
        await Promise.all(keysWithoutPrefix.map((key) => client.del(key)));
    }
};
