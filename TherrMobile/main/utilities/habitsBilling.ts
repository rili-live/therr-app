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
 * Run a purchase to completion.
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
export const requestFounderPurchase = (productId: string): Promise<IHabitsPurchaseResult> => {
    const iap = getIap();

    if (!iap) {
        return Promise.reject(new Error('module-missing'));
    }

    return new Promise((resolve, reject) => {
        let isSettled = false;
        let updateSub: any;
        let errorSub: any;

        const cleanup = () => {
            updateSub?.remove?.();
            errorSub?.remove?.();
        };

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
            iap.requestPurchase({
                request: {
                    android: { skus: [productId] },
                },
                type: 'in-app',
            });
        } catch (err) {
            if (!isSettled) {
                isSettled = true;
                cleanup();
                reject(err);
            }
        }
    });
};

/**
 * Acknowledge the purchase with the store, after the server has recorded it.
 *
 * `isConsumable: false` — this is a one-time, permanent unlock. Consuming it
 * would let the same account buy it again, and would lose the record Play keeps
 * of the entitlement.
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
export const getOwnedFounderPurchase = async (productId: string): Promise<IHabitsPurchaseResult | null> => {
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
