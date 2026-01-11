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

const TEST_KEY_PREFIX = 'websocket-service:test:';

type RedisClient = InstanceType<typeof Redis>;

let testRedisPub: RedisClient | null = null;
let testRedisSub: RedisClient | null = null;

/**
 * Create Redis clients for testing (pub/sub pattern)
 */
const createTestRedisClients = (): { pub: RedisClient; sub: RedisClient } => {
    const config = {
        host: process.env.REDIS_PUB_HOST,
        port: Number(process.env.REDIS_PUB_PORT),
        keyPrefix: TEST_KEY_PREFIX,
        lazyConnect: true,
    };

    return {
        pub: new Redis(config),
        sub: new Redis({ ...config, keyPrefix: '' }), // Sub client doesn't need prefix
    };
};

/**
 * Get the test Redis pub client.
 * Creates a new connection if one doesn't exist.
 */
export const getTestRedisPub = (): RedisClient => {
    if (!testRedisPub) {
        const clients = createTestRedisClients();
        testRedisPub = clients.pub;
        testRedisSub = clients.sub;
    }
    return testRedisPub;
};

/**
 * Get the test Redis sub client.
 */
export const getTestRedisSub = (): RedisClient => {
    if (!testRedisSub) {
        const clients = createTestRedisClients();
        testRedisPub = clients.pub;
        testRedisSub = clients.sub;
    }
    return testRedisSub;
};

/**
 * Connect to Redis
 */
export const connectRedis = async (): Promise<void> => {
    const pub = getTestRedisPub();
    const sub = getTestRedisSub();
    await Promise.all([pub.connect(), sub.connect()]);
};

/**
 * Close the test Redis connections.
 * Should be called after all tests complete.
 */
export const closeTestRedisConnection = async (): Promise<void> => {
    const promises: Promise<string>[] = [];
    if (testRedisPub) {
        promises.push(testRedisPub.quit());
        testRedisPub = null;
    }
    if (testRedisSub) {
        promises.push(testRedisSub.quit());
        testRedisSub = null;
    }
    await Promise.all(promises);
};

/**
 * Check if the Redis connection is healthy.
 */
export const checkRedisConnection = async (): Promise<boolean> => {
    try {
        const pub = getTestRedisPub();
        await pub.connect();
        const result = await pub.ping();
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
    const client = getTestRedisPub();
    // Note: keyPrefix is automatically added by ioredis
    const keys = await client.keys(`${pattern}*`);
    if (keys.length > 0) {
        // Remove the prefix that was added when getting keys
        const keysWithoutPrefix = keys.map((key) => key.replace(TEST_KEY_PREFIX, ''));
        await Promise.all(keysWithoutPrefix.map((key) => client.del(key)));
    }
};
