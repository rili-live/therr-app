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
 *
 * Only a `ready` client is closed gracefully. Everything else is torn down with
 * `disconnect()`, which is synchronous and abandons any queued command.
 *
 * `getTestRedisClient` constructs a `lazyConnect` client, so every helper in this
 * module — including `checkRedisConnection`, which the test bodies call to decide
 * whether to skip — leaves `testRedisClient` set even when nothing ever connected.
 * On a machine with no Redis the bodies skipped correctly and this `after all` hook
 * still tried to close a socket that was never open, which is two failures on every
 * push `.husky/pre-push` runs, in a teardown unrelated to the diff being pushed.
 *
 * There are two distinct ways that goes wrong, and only the first was previously
 * diagnosed:
 *
 *  - Nothing ever called `connect()`: status is `wait`, and `quit()` rejects with
 *    `Error: Connection is closed`.
 *  - `connect()` was called against a host that is not listening: ioredis keeps
 *    retrying, status sits at `connecting`/`reconnecting`, and `quit()` does not
 *    reject at all — it queues the QUIT behind a connection that never arrives and
 *    hangs until mocha times the hook out. Guarding on "was opened" alone still
 *    fails here, just with a less obvious error.
 *
 * `status` is ioredis's own view of the socket, so it cannot drift from reality the
 * way a parallel boolean would. The try/catch covers the remaining race, a
 * connection that ends between the check and the call.
 */
export const closeTestRedisConnection = async (): Promise<void> => {
    if (testRedisClient) {
        const client = testRedisClient;

        // Cleared first: a failure below must not leave the next caller holding a
        // client this function has already given up on.
        testRedisClient = null;

        try {
            if (client.status === 'ready') {
                await client.quit();
            } else {
                client.disconnect();
            }
        } catch (error) {
            // Teardown must not fail a suite over a connection that is already gone.
        }
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
 *
 * A no-op unless the client is actually connected. Without that guard this hangs
 * rather than throwing when Redis is absent: ioredis queues `keys` against a
 * connection it is still retrying, so the promise never settles and the caller's
 * `try { } catch { }` — which every caller has — cannot help, because there is no
 * rejection to catch. Mocha then fails the hook on a 2000ms timeout.
 *
 * That is what made `.husky/pre-push` unpassable with Redis down. Both integration
 * suites guard their `beforeEach` with the `skipTests` flag they set from
 * `checkRedisConnection`, and both then call this from an `after` hook that does
 * not. Guarding here rather than in those two hooks means a third suite cannot
 * reintroduce it by making the same omission.
 */
export const cleanupTestData = async (pattern: string): Promise<void> => {
    const client = getTestRedisClient();

    if (client.status !== 'ready') {
        return;
    }

    // Note: keyPrefix is automatically added by ioredis
    const keys = await client.keys(`${pattern}*`);
    if (keys.length > 0) {
        // Remove the prefix that was added when getting keys
        const keysWithoutPrefix = keys.map((key) => key.replace(TEST_KEY_PREFIX, ''));
        await Promise.all(keysWithoutPrefix.map((key) => client.del(key)));
    }
};
