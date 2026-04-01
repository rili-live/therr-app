import axios from 'axios';
import logSpan from 'therr-js-utilities/log-or-update-span';
import * as globalConfig from '../../../global-config';
import handleHttpError from '../utilities/handleHttpError';
import {
    cacheApiKeyContext,
    getCachedApiKeyContext,
    ICachedApiKeyContext,
} from '../store/redisClient';

const API_KEY_PREFIX = 'therr_sk_';

const parseApiKeyPrefix = (rawKey: string): string | null => {
    if (!rawKey || !rawKey.startsWith(API_KEY_PREFIX)) {
        return null;
    }

    const withoutPrefix = rawKey.slice(API_KEY_PREFIX.length);
    const underscoreIndex = withoutPrefix.indexOf('_');
    if (underscoreIndex !== 8) {
        return null;
    }

    const keyPrefix = withoutPrefix.slice(0, 8);
    if (!/^[0-9a-f]{8}$/.test(keyPrefix)) {
        return null;
    }

    return keyPrefix;
};

interface IValidateApiKeyResult {
    context: ICachedApiKeyContext | null;
    serviceError?: boolean;
}

/**
 * Validates an API key by first checking Redis cache, then falling back to users-service.
 * On cache miss, the validated context is cached for 5 minutes.
 */
const validateApiKeyWithService = async (apiKey: string): Promise<IValidateApiKeyResult> => {
    const keyPrefix = parseApiKeyPrefix(apiKey);
    if (!keyPrefix) {
        return { context: null };
    }

    // Check Redis cache first
    const cached = await getCachedApiKeyContext(keyPrefix);
    if (cached) {
        return { context: cached };
    }

    // Cache miss — call users-service to validate
    try {
        const response = await axios({
            method: 'post',
            url: `${globalConfig[process.env.NODE_ENV].baseUsersServiceRoute}/api-keys/validate`,
            data: { apiKey },
            headers: {
                'Content-Type': 'application/json',
            },
            timeout: 10000,
        });

        const context: ICachedApiKeyContext = {
            userId: response.data.userId,
            userName: response.data.userName,
            accessLevels: response.data.accessLevels,
            organizations: response.data.organizations,
            keyPrefix: response.data.keyPrefix,
        };

        // Cache the validated context
        cacheApiKeyContext(keyPrefix, context).catch(() => {
            // Non-blocking cache write
        });

        return { context };
    } catch (err: any) {
        if (err?.response?.status === 401 || err?.response?.status === 403) {
            return { context: null };
        }

        logSpan({
            level: 'error',
            messageOrigin: 'API_SERVER',
            messages: ['API key validation service call failed'],
            traceArgs: {
                'error.message': err?.message,
                'error.status': err?.response?.status,
            },
        });

        return { context: null, serviceError: true };
    }
};

/**
 * Middleware that authenticates requests using an API key from the x-api-key header.
 * Populates the same request properties as JWT auth for downstream compatibility.
 */
const authenticateApiKey = async (req, res, next) => {
    const apiKey = req.headers['x-api-key'];

    if (!apiKey) {
        return handleHttpError({
            res,
            message: 'API key is required',
            statusCode: 401,
        });
    }

    const { context, serviceError } = await validateApiKeyWithService(apiKey);

    if (!context) {
        if (serviceError) {
            return handleHttpError({
                res,
                message: 'Unable to validate API key. Please try again later.',
                statusCode: 503,
            });
        }
        return handleHttpError({
            res,
            message: 'Invalid or revoked API key',
            statusCode: 401,
        });
    }

    // Populate request with user context (same format as JWT auth)
    req['x-userid'] = context.userId;
    req['x-username'] = context.userName;
    req['x-user-access-levels'] = JSON.stringify(context.accessLevels);
    req['x-organizations'] = JSON.stringify(context.organizations);
    req['x-auth-type'] = 'api-key';
    req['x-api-key-prefix'] = context.keyPrefix;

    return next();
};

// Exported for unit testing only — do not use directly in production code
export { parseApiKeyPrefix, validateApiKeyWithService };
export default authenticateApiKey;
