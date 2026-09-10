/**
 * Standard JWT registered-claim configuration shared by the token signer
 * (users-service) and every verifier (api-gateway, websocket-service, and the
 * shared configureAuthenticate middleware).
 *
 * The defaults are literals so the signer and all verifiers agree on the
 * expected `iss` / `aud` values even when the environment variables are unset.
 * Override per-environment with JWT_ISSUER / JWT_AUDIENCE — but be sure every
 * service in a given environment shares the same values, otherwise valid tokens
 * will be rejected by the verifiers.
 */
const env: Record<string, string | undefined> = (typeof process !== 'undefined' && process.env)
    ? process.env
    : {};

// Who mints the token (the `iss` claim). Identifies our auth origin so a token
// minted elsewhere can't be replayed against our API.
export const JWT_ISSUER = env.JWT_ISSUER || 'therr-api';

// Who the token is for (the `aud` claim). Verifiers reject tokens minted for a
// different audience.
export const JWT_AUDIENCE = env.JWT_AUDIENCE || 'therr-app';

/**
 * Backward-compatible validation of the standard `iss` / `aud` claims on an
 * already-signature-verified token.
 *
 * - A token that CARRIES an `iss` / `aud` claim must match the expected values.
 * - A token WITHOUT these claims (legacy, pre-claims-hardening) passes, so
 *   sessions already in the wild keep working until they refresh into richer
 *   tokens. This mirrors the existing `brand`-claim handling: a missing claim
 *   is treated as legacy, a present-but-wrong claim is rejected.
 *
 * Returns `false` when the token should be rejected.
 */
export const hasValidStandardClaims = (decoded: any): boolean => {
    if (!decoded || typeof decoded !== 'object') {
        return false;
    }

    if (decoded.iss && decoded.iss !== JWT_ISSUER) {
        return false;
    }

    if (decoded.aud) {
        const audiences = Array.isArray(decoded.aud) ? decoded.aud : [decoded.aud];
        if (!audiences.includes(JWT_AUDIENCE)) {
            return false;
        }
    }

    return true;
};
