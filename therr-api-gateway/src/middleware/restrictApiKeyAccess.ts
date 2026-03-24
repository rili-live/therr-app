import handleHttpError from '../utilities/handleHttpError';

/**
 * Allowed endpoint patterns for API key authenticated requests.
 * API keys are restricted to read-heavy/data endpoints only.
 * Account management, payments, and auth endpoints are blocked.
 */
const ALLOWED_PATTERNS: { method: string; pattern: RegExp }[] = [
    // Maps service - read/search
    { method: 'GET', pattern: /^\/v1\/maps-service\/moments\// },
    { method: 'POST', pattern: /^\/v1\/maps-service\/moments\/search/ },
    { method: 'POST', pattern: /^\/v1\/maps-service\/moments\/.*\/details/ },
    { method: 'GET', pattern: /^\/v1\/maps-service\/spaces\// },
    { method: 'POST', pattern: /^\/v1\/maps-service\/spaces\/search/ },
    { method: 'POST', pattern: /^\/v1\/maps-service\/spaces\/.*\/details/ },
    { method: 'POST', pattern: /^\/v1\/maps-service\/spaces\/list/ },
    { method: 'GET', pattern: /^\/v1\/maps-service\/events\// },
    { method: 'POST', pattern: /^\/v1\/maps-service\/events\/search/ },
    { method: 'POST', pattern: /^\/v1\/maps-service\/events\/.*\/details/ },

    // Users service - read/search (not account management)
    { method: 'GET', pattern: /^\/v1\/users-service\/users\/me$/ },
    { method: 'POST', pattern: /^\/v1\/users-service\/users\/search$/ },
    { method: 'GET', pattern: /^\/v1\/users-service\/users\/[0-9a-f-]+$/ },
    { method: 'GET', pattern: /^\/v1\/users-service\/interests$/ },

    // Reactions service - read
    { method: 'GET', pattern: /^\/v1\/reactions-service\// },

    // User metrics
    { method: 'GET', pattern: /^\/v1\/users-service\/metrics\// },

    // Campaigns - read
    { method: 'GET', pattern: /^\/v1\/users-service\/campaigns\// },

    // API key management (so users can manage their own keys via API key auth)
    { method: 'GET', pattern: /^\/v1\/users-service\/api-keys$/ },
];

/**
 * Middleware that restricts API-key-authenticated requests to a safe subset of endpoints.
 * JWT-authenticated requests pass through unrestricted.
 */
const restrictApiKeyAccess = (req, res, next) => {
    // Only restrict API key authenticated requests
    if (req['x-auth-type'] !== 'api-key') {
        return next();
    }

    // Use req.path (not req.originalUrl) to avoid query string breaking regex anchors
    const isAllowed = ALLOWED_PATTERNS.some(
        (entry) => entry.method === req.method && entry.pattern.test(req.path),
    );

    if (!isAllowed) {
        return handleHttpError({
            res,
            message: 'This endpoint is not available for API key authentication. Use a JWT token instead.',
            statusCode: 403,
        });
    }

    return next();
};

export default restrictApiKeyAccess;
