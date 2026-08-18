/**
 * Jest mock for `react-native-iap`.
 *
 * The real package is a Nitro (JSI) module and reaches for native code, which
 * is unavailable under Jest. `main/utilities/habitsBilling.ts` already requires
 * it lazily inside a try/catch so an unmocked import degrades rather than
 * crashes — but that turns every billing path into a silent no-op, so a test
 * asserting on the purchase flow would pass without exercising anything. This
 * mock keeps the surface real enough to assert against.
 *
 * Only the exports `main/**` actually uses are stubbed. Listeners record their
 * callbacks so a test can drive a purchase or an error through them.
 */

type Listener = (payload: any) => void;

let purchaseUpdatedListeners: Listener[] = [];
let purchaseErrorListeners: Listener[] = [];

const makeSubscription = (remove: () => void) => ({ remove: jest.fn(remove) });

export const initConnection = jest.fn(() => Promise.resolve(true));

export const endConnection = jest.fn(() => Promise.resolve(true));

export const resetListenerState = jest.fn(() => {
    purchaseUpdatedListeners = [];
    purchaseErrorListeners = [];
});

export const purchaseUpdatedListener = jest.fn((listener: Listener) => {
    purchaseUpdatedListeners.push(listener);
    return makeSubscription(() => {
        purchaseUpdatedListeners = purchaseUpdatedListeners.filter((l) => l !== listener);
    });
});

export const purchaseErrorListener = jest.fn((listener: Listener) => {
    purchaseErrorListeners.push(listener);
    return makeSubscription(() => {
        purchaseErrorListeners = purchaseErrorListeners.filter((l) => l !== listener);
    });
});

export const fetchProducts = jest.fn(() => Promise.resolve([]));

export const getAvailablePurchases = jest.fn(() => Promise.resolve([]));

export const requestPurchase = jest.fn();

export const finishTransaction = jest.fn(() => Promise.resolve(true));

/** Test helper — drive a completed purchase through the update listeners. */
export const __emitPurchaseUpdate = (purchase: any) => {
    purchaseUpdatedListeners.forEach((listener) => listener(purchase));
};

/** Test helper — drive a failure through the error listeners. */
export const __emitPurchaseError = (error: any) => {
    purchaseErrorListeners.forEach((listener) => listener(error));
};

/** Test helper — how many listeners are still subscribed (leak detection). */
export const __getListenerCounts = () => ({
    updated: purchaseUpdatedListeners.length,
    error: purchaseErrorListeners.length,
});

export const __resetIapMock = () => {
    purchaseUpdatedListeners = [];
    purchaseErrorListeners = [];
    [
        initConnection,
        endConnection,
        resetListenerState,
        purchaseUpdatedListener,
        purchaseErrorListener,
        fetchProducts,
        getAvailablePurchases,
        requestPurchase,
        finishTransaction,
    ].forEach((fn) => fn.mockClear());
};

export default {
    endConnection,
    fetchProducts,
    finishTransaction,
    getAvailablePurchases,
    initConnection,
    purchaseErrorListener,
    purchaseUpdatedListener,
    requestPurchase,
    resetListenerState,
};
