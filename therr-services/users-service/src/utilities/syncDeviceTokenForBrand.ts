// eslint-disable-next-line import/extensions, import/no-unresolved
import { getBrandContext } from 'therr-js-utilities/http';
// eslint-disable-next-line import/extensions, import/no-unresolved
import logSpan from 'therr-js-utilities/log-or-update-span';
import Store from '../store';

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
const syncDeviceTokenForBrand = async (
    headers: { [key: string]: any },
    userId: string | undefined,
    token: string | undefined | null,
): Promise<void> => {
    if (!token || !userId) return;
    const { brandVariation } = getBrandContext(headers);
    const platform = (headers['x-platform'] as string) || 'mobile';
    try {
        await Store.userDeviceTokens.upsertToken(brandVariation, userId, platform, token);
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
