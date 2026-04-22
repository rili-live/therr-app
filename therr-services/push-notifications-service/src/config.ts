/**
 * Centralized runtime configuration for the push-notifications service.
 * See users-service/src/config.ts for the pattern.
 *
 * This service has no PostgreSQL dependency; Redis is required for
 * location caching and session state.
 */

type RequiredKey =
    | 'PUSH_NOTIFICATIONS_SERVICE_API_PORT'
    | 'PUSH_NOTIFICATIONS_GOOGLE_CREDENTIALS_BASE64'
    | 'REDIS_GENERIC_HOST'
    | 'REDIS_GENERIC_PORT';

const requiredKeys: RequiredKey[] = [
    'PUSH_NOTIFICATIONS_SERVICE_API_PORT',
    'PUSH_NOTIFICATIONS_GOOGLE_CREDENTIALS_BASE64',
    'REDIS_GENERIC_HOST',
    'REDIS_GENERIC_PORT',
];

export const validateEnv = (): void => {
    const missing = requiredKeys.filter((key) => !process.env[key]);
    if (missing.length) {
        throw new Error(
            `push-notifications-service: missing required environment variables: ${missing.join(', ')}`,
        );
    }
};

const getStr = (key: string, fallback = ''): string => process.env[key] ?? fallback;
const getNum = (key: string, fallback: number): number => {
    const raw = process.env[key];
    const parsed = raw ? Number(raw) : NaN;
    return Number.isFinite(parsed) ? parsed : fallback;
};

const config = {
    nodeEnv: getStr('NODE_ENV', 'development'),
    port: getStr('PUSH_NOTIFICATIONS_SERVICE_API_PORT'),
    uriWhitelist: getStr('URI_WHITELIST').split(',').filter(Boolean),
    redis: {
        host: getStr('REDIS_GENERIC_HOST'),
        port: getNum('REDIS_GENERIC_PORT', 6379),
    },
};

export default config;
