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
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const TEST_KEY_PREFIX = 'api-gateway:test:';

type RedisClient = InstanceType<typeof Redis>;

let testRedisClient: RedisClient | null = null;
let testRedisEphemeralClient: RedisClient | null = null;

/**
 * Create a Redis client for testing
 */
const createTestRedisClient = (): RedisClient => {
    const client = new Redis({
        host: process.env.REDIS_GENERIC_HOST || 'localhost',
        port: Number(process.env.REDIS_GENERIC_PORT) || 6379,
        keyPrefix: TEST_KEY_PREFIX,
        lazyConnect: true,
    });
    // Suppress unhandled error events when Redis is unavailable
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    client.on('error', () => {});
    return client;
};

/**
 * Create an ephemeral Redis client for testing
 */
const createTestRedisEphemeralClient = (): RedisClient => {
    const client = new Redis({
        host: process.env.REDIS_EPHEMERAL_HOST || 'localhost',
        port: Number(process.env.REDIS_EPHEMERAL_PORT) || 6379,
        keyPrefix: TEST_KEY_PREFIX,
        lazyConnect: true,
    });
    // Suppress unhandled error events when Redis is unavailable
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    client.on('error', () => {});
    return client;
};

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
 * Get the test ephemeral Redis connection.
 */
export const getTestRedisEphemeralClient = (): RedisClient => {
    if (!testRedisEphemeralClient) {
        testRedisEphemeralClient = createTestRedisEphemeralClient();
    }
    return testRedisEphemeralClient;
};

/**
 * Connect to Redis
 */
export const connectRedis = async (): Promise<void> => {
    const client = getTestRedisClient();
    const ephemeralClient = getTestRedisEphemeralClient();
    await Promise.all([client.connect(), ephemeralClient.connect()]);
};

/**
 * Close the test Redis connections.
 * Should be called after all tests complete.
 */
export const closeTestRedisConnection = async (): Promise<void> => {
    const promises: Promise<string>[] = [];
    if (testRedisClient) {
        // Only quit if the connection is open (status is 'ready' or 'connect')
        if (testRedisClient.status === 'ready' || testRedisClient.status === 'connect') {
            promises.push(testRedisClient.quit());
        } else {
            // Force disconnect without sending QUIT command (synchronous, no promise needed)
            testRedisClient.disconnect();
        }
        testRedisClient = null;
    }
    if (testRedisEphemeralClient) {
        if (testRedisEphemeralClient.status === 'ready' || testRedisEphemeralClient.status === 'connect') {
            promises.push(testRedisEphemeralClient.quit());
        } else {
            testRedisEphemeralClient.disconnect();
        }
        testRedisEphemeralClient = null;
    }
    if (promises.length > 0) {
        await Promise.all(promises);
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
