/**
 * Centralized runtime configuration for the reactions service.
 * See users-service/src/config.ts for the pattern.
 */

type RequiredKey =
    | 'REACTIONS_SERVICE_API_PORT'
    | 'REACTIONS_SERVICE_DATABASE'
    | 'DB_HOST_MAIN_READ'
    | 'DB_HOST_MAIN_WRITE'
    | 'DB_USER_MAIN_READ'
    | 'DB_USER_MAIN_WRITE'
    | 'DB_PASSWORD_MAIN_READ'
    | 'DB_PASSWORD_MAIN_WRITE'
    | 'DB_PORT_MAIN_READ'
    | 'DB_PORT_MAIN_WRITE';

const requiredKeys: RequiredKey[] = [
    'REACTIONS_SERVICE_API_PORT',
    'REACTIONS_SERVICE_DATABASE',
    'DB_HOST_MAIN_READ',
    'DB_HOST_MAIN_WRITE',
    'DB_USER_MAIN_READ',
    'DB_USER_MAIN_WRITE',
    'DB_PASSWORD_MAIN_READ',
    'DB_PASSWORD_MAIN_WRITE',
    'DB_PORT_MAIN_READ',
    'DB_PORT_MAIN_WRITE',
];

export const validateEnv = (): void => {
    const missing = requiredKeys.filter((key) => !process.env[key]);
    if (missing.length) {
        throw new Error(
            `reactions-service: missing required environment variables: ${missing.join(', ')}`,
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
    port: getStr('REACTIONS_SERVICE_API_PORT'),
    uriWhitelist: getStr('URI_WHITELIST').split(',').filter(Boolean),
    db: {
        name: getStr('REACTIONS_SERVICE_DATABASE'),
        read: {
            host: getStr('DB_HOST_MAIN_READ'),
            user: getStr('DB_USER_MAIN_READ'),
            password: getStr('DB_PASSWORD_MAIN_READ'),
            port: getNum('DB_PORT_MAIN_READ', 5432),
        },
        write: {
            host: getStr('DB_HOST_MAIN_WRITE'),
            user: getStr('DB_USER_MAIN_WRITE'),
            password: getStr('DB_PASSWORD_MAIN_WRITE'),
            port: getNum('DB_PORT_MAIN_WRITE', 5432),
        },
    },
};

export default config;
