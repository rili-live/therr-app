/**
 * Centralized runtime configuration for the websocket service.
 * See users-service/src/config.ts for the pattern.
 *
 * This service has no PostgreSQL dependency; Redis is required for the
 * socket.io adapter and session storage.
 */

type RequiredKey = 'SOCKET_PORT';

const requiredKeys: RequiredKey[] = ['SOCKET_PORT'];

export const validateEnv = (): void => {
    const missing = requiredKeys.filter((key) => !process.env[key]);
    if (missing.length) {
        throw new Error(
            `websocket-service: missing required environment variables: ${missing.join(', ')}`,
        );
    }
};

const getStr = (key: string, fallback = ''): string => process.env[key] ?? fallback;
const getNum = (key: string, fallback: number): number => {
    const raw = process.env[key];
    const parsed = raw ? Number(raw) : NaN;
    return Number.isFinite(parsed) ? parsed : fallback;
};

export const config = {
    nodeEnv: getStr('NODE_ENV', 'development'),
    port: getNum('SOCKET_PORT', 7743),
    uriWhitelist: getStr('URI_WHITELIST').split(',').filter(Boolean),
};

export default config;
