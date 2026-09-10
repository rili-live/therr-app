// eslint-disable-next-line import/extensions, import/no-unresolved
import { getBrandContext } from 'therr-js-utilities/http';
// eslint-disable-next-line import/extensions, import/no-unresolved
import logSpan from 'therr-js-utilities/log-or-update-span';
import Store from '../store';
import { LEGACY_TOKEN_PLATFORM } from '../store/UserDeviceTokensStore';

// Phase 2 of the multi-app data isolation rollout. The legacy `users.deviceMobileFirebaseToken`
// column gets overwritten when a user installs a second branded app on the same device, which
// breaks push routing for the original brand. The new `main.userDeviceTokens` table stores one
// row per (userId, brand, platform), making cross-app routing structurally correct.
//
// Until mobile clients have re-registered against the new endpoint (typically on next app
// open), both writes must succeed for backwards compatibility. Push routing reads the new
// table first and falls back to the legacy column when no row exists.
//
// This helper is fire-and-forget for the new write path: a failure here must NOT block the
// surrounding user update because the legacy column is still authoritative during the
// dual-write window. Errors are logged for diagnosis but swallowed.

// The platform values that may reach the UNIQUE (userId, brandVariation, platform) key.
//
// 'ios' | 'android' | 'web' are what the `20260425000003_main.userDeviceTokens` migration
// documents; 'ios' and 'android' come from `TherrMobile/main/constants/requestPlatform.ts`.
// 'desktop' is listed because that — not 'web' — is the literal both web clients actually send
// (`therr-client-web/src/interceptors.ts`, and the dashboard's). Folding it into the legacy
// bucket instead would collide a browser registration with the user's phone on one row.
const KNOWN_PLATFORMS = new Set(['ios', 'android', 'web', 'desktop']);

// Anything we don't recognise — including the legacy 'mobile' and an absent header — files
// under LEGACY_TOKEN_PLATFORM rather than creating an unbounded set of platform keys from an
// untrusted header. See UserDeviceTokensStore for why that value is kept working.
export const normalizePlatform = (rawPlatform?: unknown): string => {
    const value = String(rawPlatform || '').trim().toLowerCase();
    return KNOWN_PLATFORMS.has(value) ? value : LEGACY_TOKEN_PLATFORM;
};

const syncDeviceTokenForBrand = async (
    headers: { [key: string]: any },
    userId: string | undefined,
    token: string | undefined | null,
): Promise<void> => {
    if (!token || !userId) return;
    const { brandVariation } = getBrandContext(headers);
    const platform = normalizePlatform(headers['x-platform']);
    try {
        await Store.userDeviceTokens.upsertToken(brandVariation, userId, platform, token);
        // A client that reports a real platform has superseded any row it previously wrote
        // under the legacy 'mobile' key. Leaving that row behind would let a stale token
        // outlive the device it came from and, because routing reads the freshest row, would
        // do nothing useful — but it would keep answering the push-diagnostics endpoint with
        // a phantom registration. Dropping it keeps one row per real device.
        if (platform !== LEGACY_TOKEN_PLATFORM) {
            await Store.userDeviceTokens.deleteLegacyPlatformRow(brandVariation, userId);
        }
    } catch (err: any) {
        logSpan({
            level: 'warn',
            messageOrigin: 'API_SERVER',
            messages: ['Failed to upsert userDeviceTokens row (Phase 2 dual-write)'],
            traceArgs: {
                'error.message': err?.message,
                'user.id': userId,
                'pushNotification.brandVariation': brandVariation,
                'pushNotification.platform': platform,
                source: 'users-service',
            },
        });
    }
};

export default syncDeviceTokenForBrand;
