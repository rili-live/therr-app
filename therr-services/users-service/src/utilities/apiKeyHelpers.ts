import * as crypto from 'crypto';

const API_KEY_PREFIX = 'therr_sk_';

/**
 * Computes SHA-256 hash of a raw API key for storage/comparison.
 */
export const hashApiKey = (rawKey: string): string => crypto
    .createHash('sha256')
    .update(rawKey, 'utf8')
    .digest('hex');

/**
 * Generates a new API key with format: therr_sk_<8-char-hex-prefix>_<44-char-base64url-random>
 * Returns the raw key (shown once to user), its SHA-256 hash (stored in DB), and the prefix (for lookup).
 */
export const generateApiKey = (): { rawKey: string; hashedKey: string; keyPrefix: string } => {
    const prefixBytes = crypto.randomBytes(4); // 4 bytes = 8 hex chars
    const keyPrefix = prefixBytes.toString('hex');
    const randomPart = crypto.randomBytes(32).toString('base64url'); // 44 chars

    const rawKey = `${API_KEY_PREFIX}${keyPrefix}_${randomPart}`;
    const hashedKey = hashApiKey(rawKey);

    return { rawKey, hashedKey, keyPrefix };
};

/**
 * Parses a raw API key to extract the prefix for DB lookup.
 * Returns null if the key format is invalid.
 */
export const parseApiKey = (rawKey: string): { keyPrefix: string } | null => {
    if (!rawKey || !rawKey.startsWith(API_KEY_PREFIX)) {
        return null;
    }

    const withoutPrefix = rawKey.slice(API_KEY_PREFIX.length);
    const underscoreIndex = withoutPrefix.indexOf('_');
    if (underscoreIndex !== 8) {
        return null; // keyPrefix must be exactly 8 hex chars
    }

    const keyPrefix = withoutPrefix.slice(0, 8);
    if (!/^[0-9a-f]{8}$/.test(keyPrefix)) {
        return null;
    }

    return { keyPrefix };
};
