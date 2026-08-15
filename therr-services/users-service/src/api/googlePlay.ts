import axios from 'axios';
import { JWT } from 'google-auth-library';
import logSpan from 'therr-js-utilities/log-or-update-span';

/**
 * Minimal Google Play Developer API client for verifying and acknowledging
 * one-time (non-consumable) in-app purchases.
 *
 * WHY NOT THE `googleapis` PACKAGE
 *
 * `googleapis` is a ~50MB umbrella package covering every Google API, and this
 * service needs exactly two endpoints from one of them. `google-auth-library`
 * is already a dependency (it backs Google SSO in `handlers/helpers/user.ts`)
 * and is the only non-trivial part — minting a signed JWT and exchanging it for
 * an access token. The two REST calls are ordinary HTTP.
 *
 * CREDENTIALS
 *
 * `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON` holds the service-account key, either as
 * raw JSON or base64-encoded (k8s secrets are easier to manage base64'd, and
 * accepting both removes a class of "works locally, fails in prod" bug). The
 * account must be granted access to the Play Console with at least the
 * "View financial data, orders, and cancellation survey responses" permission,
 * which is what `purchases.products.get` requires.
 *
 * When the variable is unset the client reports unconfigured rather than
 * throwing at import time. A users-service instance that never sees a HABITS
 * purchase must still boot — the same reason the Stripe client is constructed
 * with an empty key rather than asserting one.
 */
const PLAY_API_BASE = 'https://androidpublisher.googleapis.com/androidpublisher/v3';
const PLAY_SCOPE = 'https://www.googleapis.com/auth/androidpublisher';

/**
 * `purchaseState` values from the Play Developer API. 0 is the only one that
 * means money changed hands and stuck.
 */
export const PURCHASE_STATE_PURCHASED = 0;
export const PURCHASE_STATE_CANCELED = 1;
export const PURCHASE_STATE_PENDING = 2;

/** `acknowledgementState`: 1 means Play already has our acknowledgement. */
export const ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED = 1;

export interface IPlayProductPurchase {
    purchaseState: number;
    consumptionState?: number;
    acknowledgementState: number;
    orderId?: string;
    purchaseTimeMillis?: string;
    productId?: string;
    /** Present only when the caller has financial-data permission. */
    priceAmountMicros?: string;
    priceCurrencyCode?: string;
    /** Play returns 0 for a real purchase and 1 for a license-tester purchase. */
    purchaseType?: number;
    regionCode?: string;
}

const parseServiceAccount = (raw: string | undefined): any | undefined => {
    if (!raw) {
        return undefined;
    }

    // Accept raw JSON or base64. Detecting by the leading brace is more robust
    // than a flag, because the value is pasted by a human into a secret store
    // and whichever form they reach for should just work.
    const trimmed = raw.trim();
    const decoded = trimmed.startsWith('{')
        ? trimmed
        : Buffer.from(trimmed, 'base64').toString('utf8');

    try {
        return JSON.parse(decoded);
    } catch (err: any) {
        logSpan({
            level: 'error',
            messageOrigin: 'API_SERVER',
            messages: ['GOOGLE_PLAY_SERVICE_ACCOUNT_JSON could not be parsed'],
            traceArgs: {
                'error.message': err?.message,
            },
        });
        return undefined;
    }
};

/**
 * Lazily built and then cached. The JWT client refreshes its own access token,
 * so one instance for the process lifetime is correct — rebuilding per request
 * would mean a token exchange on every purchase verification.
 */
let cachedClient: JWT | null | undefined;

const getAuthClient = (): JWT | null => {
    if (cachedClient !== undefined) {
        return cachedClient;
    }

    const credentials = parseServiceAccount(process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON);

    if (!credentials?.client_email || !credentials?.private_key) {
        cachedClient = null;
        return cachedClient;
    }

    cachedClient = new JWT({
        email: credentials.client_email,
        key: credentials.private_key,
        scopes: [PLAY_SCOPE],
    });

    return cachedClient;
};

export const getPackageName = (): string => process.env.GOOGLE_PLAY_PACKAGE_NAME || '';

export const isGooglePlayConfigured = (): boolean => !!getAuthClient() && !!getPackageName();

const getAuthHeaders = async (): Promise<Record<string, string>> => {
    const client = getAuthClient();

    if (!client) {
        throw new Error('Google Play service account is not configured');
    }

    const token = await client.getAccessToken();

    if (!token?.token) {
        throw new Error('Failed to mint a Google Play access token');
    }

    return { Authorization: `Bearer ${token.token}` };
};

/**
 * Fetch the authoritative state of a one-time purchase.
 *
 * Returns `undefined` for a token Play does not recognise (404) — the caller
 * turns that into a 400 rather than a 500, because an unknown token is a client
 * problem (a forged or stale token), not a server fault.
 */
export const getProductPurchase = async (
    productId: string,
    purchaseToken: string,
): Promise<IPlayProductPurchase | undefined> => {
    const headers = await getAuthHeaders();
    const packageName = getPackageName();
    const url = `${PLAY_API_BASE}/applications/${encodeURIComponent(packageName)}`
        + `/purchases/products/${encodeURIComponent(productId)}`
        + `/tokens/${encodeURIComponent(purchaseToken)}`;

    try {
        const response = await axios({ method: 'get', url, headers });
        return response.data as IPlayProductPurchase;
    } catch (err: any) {
        if (err?.response?.status === 404 || err?.response?.status === 410) {
            return undefined;
        }
        throw err;
    }
};

/**
 * Tell Play we have delivered the entitlement.
 *
 * This is not optional bookkeeping: Play automatically refunds and revokes any
 * purchase that is not acknowledged within three days. It is called after the
 * purchase row is written and the access level granted, so a failure here
 * leaves an entitled user whose purchase we can retry acknowledging, rather
 * than an acknowledged purchase we failed to honour.
 *
 * Already-acknowledged purchases are skipped by the caller reading
 * `acknowledgementState`, but Play also treats a repeat acknowledge as a
 * success, so a retry is safe either way.
 */
export const acknowledgeProductPurchase = async (
    productId: string,
    purchaseToken: string,
): Promise<void> => {
    const headers = await getAuthHeaders();
    const packageName = getPackageName();
    const url = `${PLAY_API_BASE}/applications/${encodeURIComponent(packageName)}`
        + `/purchases/products/${encodeURIComponent(productId)}`
        + `/tokens/${encodeURIComponent(purchaseToken)}:acknowledge`;

    await axios({
        method: 'post',
        url,
        headers,
        data: {},
    });
};

export default {
    acknowledgeProductPurchase,
    getPackageName,
    getProductPurchase,
    isGooglePlayConfigured,
};
