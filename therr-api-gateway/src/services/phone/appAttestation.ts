import * as admin from 'firebase-admin';

/**
 * Did this verification-code request come from a genuine install of one of our apps?
 *
 * SMS pumping never runs through the app: the 2026-10 runs were scripts on rotating residential
 * and VPS addresses calling `/phone/register/start` directly. The Android apps attach a Firebase
 * App Check token (Play Integrity) to the requests that cost us a text, and the gateway sorts
 * every such request into one of three lanes:
 *
 * - `attested` — a token that verifies against our Firebase project. Normal limits apply.
 * - `unattested` — no token, or one we could not check. This is every build that predates App
 *   Check (and iOS, until App Attest is wired up), so it must keep working for real users: it is
 *   held to the cheapest destinations under its own small hourly budget (the strict lane).
 * - `forged` — a token that is present and provably not ours (bad signature, another project,
 *   garbage). No genuine client sends one, so the caller is shadow-banned.
 *
 * The asymmetry is deliberate. Only an *affirmatively* bad token is `forged`: when Firebase's
 * key endpoint is unreachable, or the token has merely expired, the request is `unattested`. An
 * outage on Google's side can therefore never do worse than put real users in the strict lane —
 * whereas classing it as forged would shadow-ban every one of them, silently.
 *
 * Split out of `router.ts` (like `./verificationCodes`) so it can be unit tested without the
 * router's Twilio and Redis clients.
 */

/** The header the mobile app sends the token in (Firebase's own convention). */
export const APP_CHECK_HEADER = 'x-firebase-appcheck';

export type AppAttestation = 'attested' | 'unattested' | 'forged';

/**
 * `strict-lane` (default): as described above.
 * `enforce`: refuse unattested requests outright — flip to this once old builds have aged out.
 * `off`: treat every request as attested — the kill switch if App Check itself misbehaves.
 */
export type SmsAppCheckMode = 'strict-lane' | 'enforce' | 'off';

export const getSmsAppCheckMode = (rawMode = process.env.SMS_APP_CHECK_MODE): SmsAppCheckMode => {
    const mode = `${rawMode || ''}`.trim().toLowerCase();

    return mode === 'enforce' || mode === 'off' ? mode : 'strict-lane';
};

/** The slice of `admin.appCheck()` this module needs. */
export interface IAppCheckVerifier {
    verifyToken: (token: string) => Promise<{ appId: string }>;
}

// Signals, in the SDK's own messages, that the token could not be *checked* rather than that it
// failed the check. firebase-admin maps a JWKS fetch failure to the same `invalid-argument` code
// as a forged signature, so the message is the only thing that tells them apart. The same goes for
// a `kid` missing from the key set: firebase-admin caches the JWKS for a fixed 6h and never refetches
// on a miss, so a genuine token signed with a freshly rotated key fails this way too.
const UNVERIFIABLE_MESSAGE_PATTERNS = [/error fetching/i, /public keys/i, /known public key/i];
const UNVERIFIABLE_ERROR_CODES = ['app-check/app-check-token-expired', 'app-check/invalid-credential'];

export const isUnverifiableAppCheckError = (err: any): boolean => UNVERIFIABLE_ERROR_CODES.includes(err?.code)
    || UNVERIFIABLE_MESSAGE_PATTERNS.some((pattern) => pattern.test(`${err?.message || ''}`));

let defaultVerifier: IAppCheckVerifier | undefined;

/**
 * Verification needs only the project id: firebase-admin checks the token's signature against
 * Firebase's public JWKS and its audience against `projects/<id>`, so no service-account
 * credential is required. Named, so it cannot collide with an app another module initializes.
 */
const getDefaultVerifier = (): IAppCheckVerifier => {
    if (!defaultVerifier) {
        const appName = 'therr-app-check';
        const app = admin.apps.find((existing) => existing?.name === appName)
            || admin.initializeApp({ projectId: process.env.FIREBASE_APP_CHECK_PROJECT_ID || 'therr-app' }, appName);

        defaultVerifier = admin.appCheck(app);
    }

    return defaultVerifier;
};

export interface IAppAttestationResult {
    attestation: AppAttestation;
    /** The Firebase app id the token was minted for, when it verified. Logged, not enforced. */
    appId?: string;
    reason?: string;
}

export const getAppAttestation = async (
    rawToken: unknown,
    verifier?: IAppCheckVerifier,
): Promise<IAppAttestationResult> => {
    const token = Array.isArray(rawToken) ? rawToken[0] : rawToken;

    if (typeof token !== 'string' || !token.trim()) {
        return { attestation: 'unattested', reason: 'missing' };
    }

    try {
        const { appId } = await (verifier || getDefaultVerifier()).verifyToken(token.trim());

        return { attestation: 'attested', appId };
    } catch (err: any) {
        if (isUnverifiableAppCheckError(err)) {
            return { attestation: 'unattested', reason: err?.code || err?.message };
        }

        return { attestation: 'forged', reason: err?.message };
    }
};
