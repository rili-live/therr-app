import jwt from 'jsonwebtoken';

/**
 * Short-lived proof that the bearer controls a phone number.
 *
 * The API gateway owns the SMS round-trip (Twilio + the Redis code cache), but the
 * account it unlocks is created by the users-service. Rather than have the gateway
 * proxy the whole registration, it mints one of these tokens after a correct code
 * and hands it to the client, which passes it back on `POST /users`. The
 * users-service verifies the signature and trusts the `phoneNumber` claim.
 *
 * Both sides share `JWT_SECRET`, so this is symmetric-signed like the id/refresh
 * tokens. The claims deliberately mirror those tokens' `iss`/`aud` shape so a
 * phone-verification token can never be replayed as a session token (and vice
 * versa) — `type` is checked on verify and the audience differs.
 */

export const PHONE_VERIFICATION_TOKEN_TYPE = 'phone-verification';
export const PHONE_VERIFICATION_TOKEN_AUDIENCE = 'therr-phone-verification';
export const PHONE_VERIFICATION_TOKEN_ISSUER = 'therr-api-gateway';

// 20 minutes: long enough to finish the email/password step at a relaxed pace,
// short enough that a leaked token (e.g. from a shared device) is dead quickly.
export const PHONE_VERIFICATION_TOKEN_TTL_SECONDS = 60 * 20;

export type PhoneVerificationPurpose = 'register' | 'login';

export interface IPhoneVerificationClaims {
    phoneNumber: string;
    purpose: PhoneVerificationPurpose;
    type: typeof PHONE_VERIFICATION_TOKEN_TYPE;
    iat?: number;
    exp?: number;
}

/**
 * Mints a signed proof-of-phone-ownership token. `phoneNumber` MUST already be
 * normalized (E.164) by the caller so the claim matches what the users-service
 * writes to `main.users.phoneNumber`.
 */
export const createPhoneVerificationToken = (
    phoneNumber: string,
    purpose: PhoneVerificationPurpose = 'register',
    secret: string = process.env.JWT_SECRET || '',
): string => jwt.sign(
    {
        phoneNumber,
        purpose,
        type: PHONE_VERIFICATION_TOKEN_TYPE,
    },
    secret,
    {
        expiresIn: PHONE_VERIFICATION_TOKEN_TTL_SECONDS,
        issuer: PHONE_VERIFICATION_TOKEN_ISSUER,
        audience: PHONE_VERIFICATION_TOKEN_AUDIENCE,
    },
);

/**
 * Verifies a phone-verification token and returns its claims, or `undefined`
 * when the token is missing, expired, forged, or of the wrong type/purpose.
 * Never throws — callers treat `undefined` as "no proof supplied".
 */
export const verifyPhoneVerificationToken = (
    token: string | undefined | null,
    purpose: PhoneVerificationPurpose = 'register',
    secret: string = process.env.JWT_SECRET || '',
): IPhoneVerificationClaims | undefined => {
    if (!token) {
        return undefined;
    }

    try {
        const decoded = jwt.verify(token, secret, {
            issuer: PHONE_VERIFICATION_TOKEN_ISSUER,
            audience: PHONE_VERIFICATION_TOKEN_AUDIENCE,
        }) as IPhoneVerificationClaims;

        if (decoded?.type !== PHONE_VERIFICATION_TOKEN_TYPE) {
            return undefined;
        }
        if (decoded?.purpose !== purpose) {
            return undefined;
        }
        if (!decoded?.phoneNumber) {
            return undefined;
        }

        return decoded;
    } catch (err) {
        return undefined;
    }
};

export default createPhoneVerificationToken;
