import { Platform } from 'react-native';

/**
 * Thin wrapper around `react-native-iap` for the Friends with Habits founder
 * unlock.
 *
 * WHY EVERYTHING IS REQUIRED LAZILY INSIDE try/catch
 *
 * `react-native-iap` v14 is a Nitro module — a JSI native module. Importing it
 * at module scope means an app running against an unrebuilt native project (or
 * Jest, or the Therr/Teem brands which never ship the billing code) crashes on
 * *import*, before any feature flag can decide the screen should not render.
 * This is the same rule `utilities/rewardFeedback.ts` follows for audio, and
 * for the same reason. Every entry point here degrades to "billing
 * unavailable" rather than throwing.
 *
 * WHAT THIS DELIBERATELY DOES NOT DO
 *
 * It never decides whether the user is entitled. The store tells us a purchase
 * completed and hands back a token; only the server, having asked Google what
 * that token actually is, may grant anything. A client that grants its own
 * entitlement is a client that can be told to grant it by anyone.
 */

export interface IHabitsPurchaseResult {
    purchaseToken: string;
    productId?: string;
    orderId?: string;
    /** Kept so the caller can finish the transaction after the server verifies. */
    rawPurchase: any;
}

export type BillingUnavailableReason = 'unsupported-platform' | 'module-missing' | 'connection-failed';

/**
 * Rejection code used when the store answers with neither an update nor an
 * error. Distinct from a failure on purpose: the purchase may still be in
 * flight, so the caller must not tell the user it did not go through.
 */
export const PURCHASE_TIMEOUT_CODE = 'E_PURCHASE_TIMEOUT';

/**
 * Deliberately generous. The Play sheet is a foreground UI the user drives —
 * adding a card, completing a bank challenge — and a timeout that fires while
 * they are still in it would report failure for a purchase that then succeeds.
 * This exists only to break a permanent hang, not to bound the happy path.
 */
const PURCHASE_TIMEOUT_MS = 5 * 60 * 1000;

let iapModule: any;
let hasResolvedModule = false;

const getIap = (): any | null => {
    if (hasResolvedModule) {
        return iapModule || null;
    }

    hasResolvedModule = true;

    try {
        iapModule = require('react-native-iap');
    } catch {
        iapModule = null;
    }

    return iapModule;
};

/**
 * Android only for now. iOS purchases would need StoreKit verification on the
 * server, which does not exist yet — offering the button there would take
 * someone's money for an entitlement we could not grant.
 */
export const isBillingSupported = (): boolean => Platform.OS === 'android' && !!getIap();

let isConnected = false;

export const initBilling = async (): Promise<boolean> => {
    const iap = getIap();

    if (!iap || Platform.OS !== 'android') {
        return false;
    }

    if (isConnected) {
        return true;
    }

    try {
        await iap.initConnection();
        isConnected = true;
        return true;
    } catch {
        return false;
    }
};

export const endBilling = async (): Promise<void> => {
    const iap = getIap();

    if (!iap || !isConnected) {
        return;
    }

    try {
        await iap.endConnection();
    } catch {
        // Nothing useful to do — the connection is going away regardless.
    } finally {
        isConnected = false;
        iap.resetListenerState?.();
    }
};

/**
 * Look up the store's own price string so the paywall can show what the user
 * will actually be charged, in their currency. Returns null when the product
 * is not configured yet, which is the state the app is in until the Play
 * Console product is created — the caller falls back to hiding the price
 * rather than inventing one.
 */
export const fetchFounderProduct = async (productId: string): Promise<any | null> => {
    const iap = getIap();

    if (!iap) {
        return null;
    }

    try {
        const products = await iap.fetchProducts({ skus: [productId], type: 'in-app' });
        return (products || []).find((product: any) => product?.id === productId
            || product?.productId === productId) || null;
    } catch {
        return null;
    }
};

/**
 * The subscription equivalent of `fetchFounderProduct`. Queried with
 * `type: 'subs'` because Play keeps subscriptions and one-time products in
 * separate catalogues — a subs SKU does not resolve through the `in-app` query
 * and vice versa. Returns null until the Play Console subscription is created,
 * so the paywall hides the price rather than inventing one.
 */
export const fetchPremiumProduct = async (productId: string): Promise<any | null> => {
    const iap = getIap();

    if (!iap) {
        return null;
    }

    try {
        const products = await iap.fetchProducts({ skus: [productId], type: 'subs' });
        return (products || []).find((product: any) => product?.id === productId
            || product?.productId === productId) || null;
    } catch {
        return null;
    }
};

/**
 * The Android offer token to purchase against.
 *
 * A Play subscription is bought against a specific base-plan/offer, identified
 * by an `offerToken`, not against the bare SKU the way a one-time product is —
 * `requestPurchase` for `type: 'subs'` rejects without one. The first offer on
 * the base plan is the list-price monthly plan; a fancier offer-selection UI can
 * come later, but the token has to be threaded through for a purchase to happen
 * at all. Returns null when the shape has no offers, which the caller treats as
 * "cannot purchase" rather than guessing.
 */
export const getSubscriptionOfferToken = (product: any): string | null => {
    const offers = product?.subscriptionOfferDetails
        || product?.subscriptionOfferDetailsAndroid
        || [];

    const withToken = (Array.isArray(offers) ? offers : [])
        .find((offer: any) => !!(offer?.offerToken || offer?.offerId));

    return withToken?.offerToken || withToken?.offerId || null;
};

/** Play reports money in millionths of a currency unit. */
const MICROS_PER_UNIT = 1000000;

export interface IPurchaseValue {
    /** Amount in major currency units, e.g. 20 for $20.00. */
    value: number;
    /** ISO-4217 code, e.g. "USD". */
    currency: string;
}

/**
 * The amount to report as a conversion value, read off whatever actually knows it.
 *
 * WHY THIS IS NOT A CONSTANT
 * A hardcoded `value: 20, currency: 'USD'` is right only while the Play price is
 * exactly that, for every buyer. It is wrong for anyone outside the US — Play
 * charges in local currency and Google Ads takes the `currency` field at its word,
 * so a €18 purchase reported as 20 USD overstates revenue by whatever the two
 * happen to differ by — and it stays wrong silently through a price change or a
 * promotional price, in the one number cost-per-payer is judged on.
 *
 * PREFERRED SOURCE FIRST
 * The verify response is authoritative: `priceAmountMicros` / `priceCurrencyCode`
 * on it are what the server read back from Google Play for this specific order,
 * after verification. The store product is the fallback — it is the price on
 * offer now, which is the same number except for a purchase recovered days after
 * a price change. Both are read because the recovery path has one and not always
 * the other.
 *
 * RETURNS NULL RATHER THAN A GUESS
 * A missing conversion value is a gap someone can find and fix. An invented one
 * is a number that looks right and is not, and it propagates into every bid
 * decision downstream. The caller omits the fields instead.
 */
/**
 * The recurring (list-price) pricing phase of a subscription product, or null.
 *
 * A subscription offer's `pricingPhaseList` can lead with a free trial or an
 * introductory price; the amount that matters for a conversion value is the one
 * the user actually pays every month, which is the last non-zero phase. Reading
 * the first phase would report a €0 trial as the purchase value.
 */
const readRecurringPricingPhase = (source: any): any | null => {
    const offers = source?.subscriptionOfferDetails
        || source?.subscriptionOfferDetailsAndroid;

    if (!Array.isArray(offers) || !offers.length) {
        return null;
    }

    const phases = offers[0]?.pricingPhases?.pricingPhaseList
        || offers[0]?.pricingPhases
        || [];

    const paidPhases = (Array.isArray(phases) ? phases : [])
        .filter((phase: any) => Number(phase?.priceAmountMicros) > 0);

    return paidPhases.length ? paidPhases[paidPhases.length - 1] : null;
};

const readPurchaseValue = (source: any): IPurchaseValue | null => {
    if (!source || typeof source !== 'object') {
        return null;
    }

    // Android's `fetchProducts` nests the one-time price a level down; a verified
    // purchase row and the library's normalized product shape both hold it flat.
    // A subscription product nests it deeper still — inside the recurring pricing
    // phase of a subscription offer — so read that too.
    const offerDetails = source.oneTimePurchaseOfferDetails;
    const subscriptionPhase = readRecurringPricingPhase(source);
    const currency = source.priceCurrencyCode
        || source.currency
        || offerDetails?.priceCurrencyCode
        || subscriptionPhase?.priceCurrencyCode;

    if (typeof currency !== 'string' || currency.length !== 3) {
        return null;
    }

    const micros = Number(
        source.priceAmountMicros
        ?? offerDetails?.priceAmountMicros
        ?? subscriptionPhase?.priceAmountMicros,
    );

    if (Number.isFinite(micros) && micros > 0) {
        return {
            // toFixed(6) clears binary-float noise without rounding away the third
            // decimal that BHD, KWD and TND actually use.
            value: Number((micros / MICROS_PER_UNIT).toFixed(6)),
            currency: currency.toUpperCase(),
        };
    }

    const price = Number(source.price);

    return Number.isFinite(price) && price > 0
        ? { value: price, currency: currency.toUpperCase() }
        : null;
};

/**
 * First source that can answer, or null when none can. See `readPurchaseValue`.
 */
export const resolvePurchaseValue = (...sources: any[]): IPurchaseValue | null => sources
    .map(readPurchaseValue)
    .find((candidate) => !!candidate) || null;

/**
 * Run a purchase to completion — the listener/timeout plumbing shared by the
 * founder unlock and the premium subscription. Only the `requestArgs` passed to
 * `iap.requestPurchase` differ between the two (an `in-app` SKU vs a `subs` SKU
 * with an offer token), so the event handling — which is the subtle part — lives
 * in one place.
 *
 * `requestPurchase` in v14 is event-based rather than promise-based: the result
 * arrives on `purchaseUpdatedListener` or `purchaseErrorListener`. This wraps
 * both into one promise so callers can `await` it, and always unsubscribes —
 * a leaked listener would fire again on the next purchase and double-verify.
 *
 * The transaction is deliberately NOT finished here. Finishing acknowledges the
 * purchase to Play, and Play treats an acknowledged purchase as delivered; if
 * we acknowledged before the server had recorded it, a failed verification
 * would leave the user charged with nothing to show. `finishPurchase` is called
 * by the caller after the server returns success.
 */
const awaitPurchaseResult = (
    productId: string,
    requestArgs: any,
): Promise<IHabitsPurchaseResult> => {
    const iap = getIap();

    if (!iap) {
        return Promise.reject(new Error('module-missing'));
    }

    return new Promise((resolve, reject) => {
        let isSettled = false;
        let updateSub: any;
        let errorSub: any;
        let timeoutId: ReturnType<typeof setTimeout> | null = null;

        const cleanup = () => {
            updateSub?.remove?.();
            errorSub?.remove?.();

            if (timeoutId) {
                clearTimeout(timeoutId);
                timeoutId = null;
            }
        };

        // Without this the promise never settles when the store goes quiet —
        // the caller's `finally` never runs and the buy button sits disabled
        // reading "Purchasing…" until the screen unmounts.
        timeoutId = setTimeout(() => {
            if (isSettled) {
                return;
            }

            isSettled = true;
            cleanup();

            const timeoutError: any = new Error('purchase-timeout');
            timeoutError.code = PURCHASE_TIMEOUT_CODE;
            reject(timeoutError);
        }, PURCHASE_TIMEOUT_MS);

        updateSub = iap.purchaseUpdatedListener((purchase: any) => {
            const token = purchase?.purchaseToken || purchase?.purchaseTokenAndroid;

            // Ignore updates for anything that is not the product we asked for;
            // the listener is global, and the library replays already-owned and
            // pending purchases through it when the connection opens. Resolving
            // on one of those would send the wrong token to the verify endpoint.
            if (!token || isSettled || isDifferentProduct(purchase, productId)) {
                return;
            }

            isSettled = true;
            cleanup();
            resolve({
                purchaseToken: token,
                productId: purchase?.id || purchase?.productId,
                orderId: purchase?.transactionId || purchase?.orderId,
                rawPurchase: purchase,
            });
        });

        errorSub = iap.purchaseErrorListener((error: any) => {
            if (isSettled) {
                return;
            }

            isSettled = true;
            cleanup();
            reject(error || new Error('purchase-failed'));
        });

        try {
            iap.requestPurchase(requestArgs);
        } catch (err) {
            if (!isSettled) {
                isSettled = true;
                cleanup();
                reject(err);
            }
        }
    });
};

export const requestFounderPurchase = (productId: string): Promise<IHabitsPurchaseResult> => awaitPurchaseResult(
    productId,
    {
        request: {
            android: { skus: [productId] },
        },
        type: 'in-app',
    },
);

/**
 * Run a subscription purchase to completion.
 *
 * Differs from the founder purchase only in the request payload: a Play
 * subscription is bought against a base-plan offer, so the Android request
 * carries `subscriptionOffers: [{ sku, offerToken }]`. The offer token comes
 * from `getSubscriptionOfferToken` on the fetched product; without it Play
 * rejects the request, so the caller resolves it before calling here.
 */
export const requestSubscriptionPurchase = (
    productId: string,
    offerToken: string,
): Promise<IHabitsPurchaseResult> => awaitPurchaseResult(
    productId,
    {
        request: {
            android: {
                skus: [productId],
                subscriptionOffers: [{ sku: productId, offerToken }],
            },
        },
        type: 'subs',
    },
);

/**
 * Acknowledge the purchase with the store, after the server has recorded it.
 *
 * `isConsumable: false` — for both the one-time founder unlock and the premium
 * subscription (a subscription is acknowledged, never consumed). Consuming it
 * would lose the record Play keeps of the entitlement. The server also
 * acknowledges directly with the Play Developer API, so a failure here is
 * recoverable and must not surface as a purchase failure to a user who has paid.
 */
export const finishPurchase = async (rawPurchase: any): Promise<void> => {
    const iap = getIap();

    if (!iap || !rawPurchase) {
        return;
    }

    try {
        await iap.finishTransaction({ purchase: rawPurchase, isConsumable: false });
    } catch {
        // The server has already granted the entitlement and acknowledged with
        // Play itself, so a failure here is recoverable and must not surface as
        // a purchase failure to a user who has paid.
    }
};

/**
 * Which product a purchase payload refers to.
 *
 * The field is not stable across the library's own shapes — `fetchProducts`
 * returns `id`, restored purchases have been seen with `productId`, and a
 * multi-SKU Android purchase carries `ids`. Read all three rather than picking
 * one and hoping.
 */
const getPurchaseProductIds = (purchase: any): string[] => [
    purchase?.id,
    purchase?.productId,
    ...(Array.isArray(purchase?.ids) ? purchase.ids : []),
].filter((id) => typeof id === 'string' && !!id);

/**
 * Does this purchase payload positively identify a *different* product?
 *
 * Deliberately asymmetric. A payload carrying no product identifier at all is
 * NOT treated as a mismatch: dropping it would hang `requestFounderPurchase`
 * forever on a shape we failed to anticipate, which is strictly worse than
 * verifying a token the server will reject anyway.
 */
const isDifferentProduct = (purchase: any, productId: string): boolean => {
    const ids = getPurchaseProductIds(purchase);

    return ids.length > 0 && !ids.includes(productId);
};

/**
 * Purchases the user already owns — the "restore" path, and the recovery path
 * for a purchase whose verification call failed after the money was taken.
 */
const getOwnedPurchase = async (productId: string): Promise<IHabitsPurchaseResult | null> => {
    const iap = getIap();

    if (!iap) {
        return null;
    }

    try {
        const purchases = await iap.getAvailablePurchases();
        const match = (purchases || []).find(
            (purchase: any) => getPurchaseProductIds(purchase).includes(productId),
        );

        if (!match) {
            return null;
        }

        const token = match.purchaseToken || match.purchaseTokenAndroid;

        return token ? {
            purchaseToken: token,
            productId,
            orderId: match.transactionId || match.orderId,
            rawPurchase: match,
        } : null;
    } catch {
        return null;
    }
};

export const getOwnedFounderPurchase = (productId: string): Promise<IHabitsPurchaseResult | null> => getOwnedPurchase(productId);

/**
 * The subscription equivalent of `getOwnedFounderPurchase` — the restore path,
 * and the recovery path for a subscription whose verification call failed after
 * the money was taken. `getAvailablePurchases` returns owned subscriptions
 * alongside products, so the same match-by-product-id logic serves both.
 */
export const getOwnedSubscription = (productId: string): Promise<IHabitsPurchaseResult | null> => getOwnedPurchase(productId);
