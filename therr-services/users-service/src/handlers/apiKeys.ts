import * as crypto from 'crypto';
import { parseHeaders } from 'therr-js-utilities/http';
import { AccessLevels } from 'therr-js-utilities/constants';
import logSpan from 'therr-js-utilities/log-or-update-span';
import Store from '../store';
import handleHttpError from '../utilities/handleHttpError';
import { generateApiKey, hashApiKey, parseApiKey } from '../utilities/apiKeyHelpers';

const MAX_KEYS_PER_USER = 3;

// Access levels that grant permission to create API keys (dashboard subscribers)
const API_KEY_ELIGIBLE_LEVELS = [
    AccessLevels.DASHBOARD_SUBSCRIBER_BASIC,
    AccessLevels.DASHBOARD_SUBSCRIBER_PRO,
    AccessLevels.DASHBOARD_SUBSCRIBER_PREMIUM,
    AccessLevels.DASHBOARD_SUBSCRIBER_AGENCY,
    AccessLevels.SUPER_ADMIN,
    AccessLevels.API_ACCESS,
];

const hasApiKeyEligibility = (userAccessLevels: string[]): boolean => API_KEY_ELIGIBLE_LEVELS
    .some((level) => userAccessLevels.includes(level));

/**
 * Validates that requestedLevels is a subset of userLevels (keys can only scope down, never up).
 */
const isSubsetOfAccessLevels = (requestedLevels: string[], userLevels: string[]): boolean => requestedLevels
    .every((level) => userLevels.includes(level));

const createApiKey = async (req, res) => {
    const { userId, userAccessLevels } = parseHeaders(req.headers);

    if (!hasApiKeyEligibility(userAccessLevels)) {
        return handleHttpError({
            res,
            message: 'An active paid subscription is required to create API keys.'
                + ' Please subscribe to a dashboard plan to enable API access.',
            statusCode: 400,
        });
    }

    try {
        // Enforce max keys per user
        const activeKeyCount = await Store.apiKeys.countByUserId(userId);
        if (activeKeyCount >= MAX_KEYS_PER_USER) {
            return handleHttpError({
                res,
                message: `Maximum of ${MAX_KEYS_PER_USER} active API keys allowed. Revoke an existing key first.`,
                statusCode: 400,
            });
        }

        const { name, accessLevels: requestedAccessLevels } = req.body;

        // Default to user's access levels if none specified
        const keyAccessLevels = requestedAccessLevels && requestedAccessLevels.length
            ? requestedAccessLevels
            : userAccessLevels;

        // Ensure requested levels are a subset of user's levels
        if (!isSubsetOfAccessLevels(keyAccessLevels, userAccessLevels)) {
            return handleHttpError({
                res,
                message: 'API key access levels cannot exceed your own access levels.',
                statusCode: 403,
            });
        }

        // Retry on keyPrefix collision (unique constraint violation)
        let rawKey = '';
        let apiKeyRecord: any;
        const MAX_RETRIES = 3;

        for (let attempt = 0; attempt < MAX_RETRIES; attempt += 1) {
            const generated = generateApiKey();
            rawKey = generated.rawKey;
            try {
                const [record] = await Store.apiKeys.create({ // eslint-disable-line no-await-in-loop
                    userId,
                    hashedKey: generated.hashedKey,
                    keyPrefix: generated.keyPrefix,
                    name,
                    accessLevels: keyAccessLevels,
                });
                apiKeyRecord = record;
                break;
            } catch (createErr: any) {
                // Retry only on unique constraint violation (PostgreSQL error code 23505)
                if (createErr?.code !== '23505' || attempt === MAX_RETRIES - 1) {
                    throw createErr;
                }
            }
        }

        logSpan({
            level: 'info',
            messageOrigin: 'API_SERVER',
            messages: ['API key created'],
            traceArgs: {
                'apiKey.id': apiKeyRecord.id,
                'apiKey.keyPrefix': apiKeyRecord.keyPrefix,
                'user.id': userId,
            },
        });

        // Return the raw key only on creation — it will never be retrievable again
        return res.status(201).send({
            ...apiKeyRecord,
            key: rawKey,
        });
    } catch (err: any) {
        return handleHttpError({
            err,
            res,
            message: 'Failed to create API key',
        });
    }
};

const listApiKeys = async (req, res) => {
    const { userId } = parseHeaders(req.headers);

    try {
        const keys = await Store.apiKeys.getByUserId(userId);
        return res.status(200).send(keys);
    } catch (err: any) {
        return handleHttpError({
            err,
            res,
            message: 'Failed to list API keys',
        });
    }
};

const revokeApiKey = async (req, res) => {
    const { userId, userAccessLevels } = parseHeaders(req.headers);
    const { id } = req.params;

    try {
        // Super admins can revoke any user's key by passing targetUserId
        const targetUserId = userAccessLevels.includes(AccessLevels.SUPER_ADMIN) && req.body.targetUserId
            ? req.body.targetUserId
            : userId;

        const result = await Store.apiKeys.invalidate(id, targetUserId);

        if (!result.length) {
            return handleHttpError({
                res,
                message: 'API key not found or already revoked',
                statusCode: 404,
            });
        }

        logSpan({
            level: 'info',
            messageOrigin: 'API_SERVER',
            messages: ['API key revoked'],
            traceArgs: {
                'apiKey.id': id,
                'user.id': userId,
                'target.userId': targetUserId,
            },
        });

        return res.status(200).send(result[0]);
    } catch (err: any) {
        return handleHttpError({
            err,
            res,
            message: 'Failed to revoke API key',
        });
    }
};

const revokeAllApiKeys = async (req, res) => {
    const { userId } = parseHeaders(req.headers);

    try {
        const result = await Store.apiKeys.invalidateAllForUser(userId);

        logSpan({
            level: 'info',
            messageOrigin: 'API_SERVER',
            messages: [`All API keys revoked for user (${result.length} keys)`],
            traceArgs: {
                'user.id': userId,
                'apiKey.revokedCount': result.length,
            },
        });

        return res.status(200).send({
            revokedCount: result.length,
            revokedKeyPrefixes: result.map((r) => r.keyPrefix),
        });
    } catch (err: any) {
        return handleHttpError({
            err,
            res,
            message: 'Failed to revoke all API keys',
        });
    }
};

/**
 * Internal-only endpoint called by the API gateway to validate an API key.
 * Not exposed publicly — called via inter-service communication.
 */
const validateApiKey = async (req, res) => {
    const { apiKey } = req.body;

    if (!apiKey) {
        return handleHttpError({
            res,
            message: 'API key is required',
            statusCode: 401,
        });
    }

    const parsed = parseApiKey(apiKey);
    if (!parsed) {
        return handleHttpError({
            res,
            message: 'Invalid API key format',
            statusCode: 401,
        });
    }

    try {
        const keyRecords = await Store.apiKeys.getByKeyPrefix(parsed.keyPrefix);

        if (!keyRecords.length) {
            return handleHttpError({
                res,
                message: 'Invalid API key',
                statusCode: 401,
            });
        }

        const keyRecord = keyRecords[0];
        const hashedInput = hashApiKey(apiKey);

        // Constant-time comparison to prevent timing attacks
        const hashBuffer = Buffer.from(hashedInput, 'hex');
        const storedBuffer = Buffer.from(keyRecord.hashedKey, 'hex');

        if (hashBuffer.length !== storedBuffer.length
            || !crypto.timingSafeEqual(hashBuffer, storedBuffer)) {
            return handleHttpError({
                res,
                message: 'Invalid API key',
                statusCode: 401,
            });
        }

        // Load user data for context headers
        const userResults = await Store.users.getUserById(keyRecord.userId, [
            'id', 'userName', 'accessLevels', 'isBlocked',
        ]);

        if (!userResults.length || userResults[0].isBlocked) {
            return handleHttpError({
                res,
                message: 'User account is blocked or not found',
                statusCode: 403,
            });
        }

        const user = userResults[0];

        // Verify user still has an active paid subscription
        const userAccessLevels = Array.isArray(user.accessLevels)
            ? user.accessLevels
            : JSON.parse(user.accessLevels || '[]');

        if (!hasApiKeyEligibility(userAccessLevels)) {
            return handleHttpError({
                res,
                message: 'API key owner no longer has an active subscription. Please renew your subscription to restore API access.',
                statusCode: 403,
            });
        }

        // Load user organizations
        const userOrgs = await Store.userOrganizations.get({ userId: user.id });
        const mappedUserOrgs = userOrgs
            .filter((o) => o.inviteStatus === 'accepted' && o.isEnabled)
            .reduce((acc, cur) => {
                acc[cur.organizationId] = cur.accessLevels;
                return acc;
            }, {});

        // Fire-and-forget: update lastAccessed
        Store.apiKeys.updateLastAccessed(keyRecord.id).catch((err) => {
            logSpan({
                level: 'error',
                messageOrigin: 'API_SERVER',
                messages: ['Failed to update API key lastAccessed'],
                traceArgs: { 'error.message': err?.message },
            });
        });

        return res.status(200).send({
            userId: user.id,
            userName: user.userName,
            accessLevels: keyRecord.accessLevels,
            organizations: mappedUserOrgs,
            keyPrefix: keyRecord.keyPrefix,
        });
    } catch (err: any) {
        return handleHttpError({
            err,
            res,
            message: 'API key validation failed',
            statusCode: 500,
        });
    }
};

export {
    createApiKey,
    listApiKeys,
    revokeApiKey,
    revokeAllApiKeys,
    validateApiKey,
};
