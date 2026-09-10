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

/**
 * `purchaseType` values.
 *
 * The important and easily-inverted part: Play sets this field ONLY when the
 * purchase did *not* go through the standard billing flow. A normal paid
 * purchase omits it entirely, so `purchaseType === undefined` is the money case
 * and a present value means something other than a customer paying list price.
 * Testing `=== 0` for "real purchase" gets this exactly backwards — 0 is the
 * license-tester value.
 */
export const PURCHASE_TYPE_TEST = 0;
export const PURCHASE_TYPE_PROMO = 1;
export const PURCHASE_TYPE_REWARDED = 2;

/**
 * `subscriptionState` values from `purchases.subscriptionsv2.get`.
 *
 * These are string enums in the v2 API, unlike the integer `purchaseState` on a
 * one-time product. The three that entitle an account are ACTIVE (paying),
 * IN_GRACE_PERIOD (a renewal charge failed but Play is still retrying and access
 * continues), and CANCELED (the user turned off auto-renew but has paid through
 * the end of the current period). EXPIRED, ON_HOLD and PAUSED do not entitle:
 * ON_HOLD means the grace period elapsed with the charge still failing, and
 * PAUSED is a user-requested suspension. `isEntitlingSubscriptionState` is the
 * single place that judgement lives.
 */
export const SUBSCRIPTION_STATE_ACTIVE = 'SUBSCRIPTION_STATE_ACTIVE';
export const SUBSCRIPTION_STATE_CANCELED = 'SUBSCRIPTION_STATE_CANCELED';
export const SUBSCRIPTION_STATE_IN_GRACE_PERIOD = 'SUBSCRIPTION_STATE_IN_GRACE_PERIOD';
export const SUBSCRIPTION_STATE_ON_HOLD = 'SUBSCRIPTION_STATE_ON_HOLD';
export const SUBSCRIPTION_STATE_PAUSED = 'SUBSCRIPTION_STATE_PAUSED';
export const SUBSCRIPTION_STATE_EXPIRED = 'SUBSCRIPTION_STATE_EXPIRED';
export const SUBSCRIPTION_STATE_PENDING = 'SUBSCRIPTION_STATE_PENDING';

/** `acknowledgementState` on the v2 subscription resource (string, not int). */
export const V2_ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED = 'ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED';

/**
 * A subscription is entitling while it is being paid for. A user who cancels
 * auto-renew keeps access until the period they already paid for ends — Play
 * reports that as CANCELED with a future `expiryTime`, not as EXPIRED — so
 * CANCELED counts here and the expiry check below is what eventually drops it.
 */
export const isEntitlingSubscriptionState = (state: string | undefined): boolean => state === SUBSCRIPTION_STATE_ACTIVE
    || state === SUBSCRIPTION_STATE_IN_GRACE_PERIOD
    || state === SUBSCRIPTION_STATE_CANCELED;

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
    /**
     * Absent for an ordinary paid purchase; set only for test (0), promo (1) and
     * rewarded (2) purchases. See the constants above.
     */
    purchaseType?: number;
    regionCode?: string;
}

/**
 * One line item of a v2 subscription purchase. The productId lives here rather
 * than in the path (the v2 get is keyed by token alone), so it is the field the
 * caller validates the purchase against.
 */
export interface IPlaySubscriptionLineItem {
    productId?: string;
    /** RFC3339. The moment access lapses if not renewed — the real expiry clock. */
    expiryTime?: string;
    autoRenewingPlan?: { autoRenewEnabled?: boolean };
}

/**
 * Subset of `purchases.subscriptionsv2.get` this service reads. v2 is used over
 * v1 because v1's fields (`paymentState`, integer `acknowledgementState`) are
 * frozen and Google steers new integrations to v2, whose `subscriptionState`
 * models grace period / on-hold / paused as first-class states rather than
 * leaving the caller to infer them from timestamps.
 */
export interface IPlaySubscriptionPurchase {
    subscriptionState?: string;
    acknowledgementState?: string;
    latestOrderId?: string;
    startTime?: string;
    /**
     * Set only when this token replaces an earlier one (a resubscribe or an
     * upgrade/downgrade). The store uses it to supersede the row the old token
     * wrote, so one account never carries two live subscription rows.
     */
    linkedPurchaseToken?: string;
    lineItems?: IPlaySubscriptionLineItem[];
    testPurchase?: object;
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

/**
 * Fetch the authoritative state of a subscription purchase (v2).
 *
 * Unlike the one-time product endpoint this is keyed by token alone — a token
 * identifies exactly one subscription, and its product id is read back from
 * `lineItems`. Returns `undefined` for a token Play does not recognise (404),
 * for the same reason `getProductPurchase` does: an unknown token is a client
 * problem, not a server fault.
 */
export const getSubscriptionPurchase = async (
    purchaseToken: string,
): Promise<IPlaySubscriptionPurchase | undefined> => {
    const headers = await getAuthHeaders();
    const packageName = getPackageName();
    const url = `${PLAY_API_BASE}/applications/${encodeURIComponent(packageName)}`
        + `/purchases/subscriptionsv2/tokens/${encodeURIComponent(purchaseToken)}`;

    try {
        const response = await axios({ method: 'get', url, headers });
        return response.data as IPlaySubscriptionPurchase;
    } catch (err: any) {
        if (err?.response?.status === 404 || err?.response?.status === 410) {
            return undefined;
        }
        throw err;
    }
};

/**
 * Acknowledge a subscription purchase.
 *
 * There is no v2 acknowledge endpoint; the v1 subscriptions acknowledge is the
 * supported call and it keys off the product id (the "subscriptionId" segment),
 * which is why the caller must pass the productId read from `lineItems`. Same
 * three-day auto-refund rule and same repeat-safe behaviour as the product
 * acknowledge above.
 */
export const acknowledgeSubscriptionPurchase = async (
    productId: string,
    purchaseToken: string,
): Promise<void> => {
    const headers = await getAuthHeaders();
    const packageName = getPackageName();
    const url = `${PLAY_API_BASE}/applications/${encodeURIComponent(packageName)}`
        + `/purchases/subscriptions/${encodeURIComponent(productId)}`
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
    acknowledgeSubscriptionPurchase,
    getPackageName,
    getProductPurchase,
    getSubscriptionPurchase,
    isGooglePlayConfigured,
};
