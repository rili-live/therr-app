import {
    it, describe, expect, afterEach, beforeAll, beforeEach, jest,
} from '@jest/globals';
import { Platform } from 'react-native';
import {
    endBilling,
    finishPurchase,
    initBilling,
    isBillingSupported,
    requestFounderPurchase,
    resolvePurchaseValue,
    PURCHASE_TIMEOUT_CODE,
} from '../../main/utilities/habitsBilling';
import {
    __emitPurchaseError,
    __emitPurchaseUpdate,
    __getListenerCounts,
    __resetIapMock,
    finishTransaction,
    requestPurchase,
} from '../../__mocks__/react-native-iap';

/**
 * The Play Billing wrapper.
 *
 * Two behaviours here are load-bearing and neither is obvious from reading the
 * call site:
 *
 *   1. `requestPurchase` in react-native-iap v14 is event-based, so the wrapper
 *      bridges two global listeners into one promise. A listener left
 *      subscribed fires again on the next purchase and double-verifies it.
 *   2. The transaction is deliberately NOT finished inside the purchase call.
 *      Finishing acknowledges delivery to Play; doing that before the server
 *      has recorded the purchase would leave a user charged with nothing.
 */
describe('habitsBilling', () => {
    beforeAll(() => {
        // The wrapper is Android-only on purpose (no server-side StoreKit
        // verification yet), and the RN Jest preset reports iOS by default.
        (Platform as any).OS = 'android';
    });

    beforeEach(() => {
        __resetIapMock();
    });

    it('reports billing as supported on Android with the module present', () => {
        expect(isBillingSupported()).toBe(true);
    });

    it('resolves with the purchase token when the store reports success', async () => {
        const pending = requestFounderPurchase('habits_lifetime_founder');

        __emitPurchaseUpdate({
            purchaseToken: 'token-abc',
            id: 'habits_lifetime_founder',
            transactionId: 'GPA.1234',
        });

        await expect(pending).resolves.toMatchObject({
            purchaseToken: 'token-abc',
            productId: 'habits_lifetime_founder',
            orderId: 'GPA.1234',
        });
    });

    it('unsubscribes both listeners once the purchase settles', async () => {
        const pending = requestFounderPurchase('habits_lifetime_founder');

        expect(__getListenerCounts()).toEqual({ updated: 1, error: 1 });

        __emitPurchaseUpdate({ purchaseToken: 'token-abc' });
        await pending;

        // A surviving listener would fire on the next purchase and verify it twice.
        expect(__getListenerCounts()).toEqual({ updated: 0, error: 0 });
    });

    it('rejects and unsubscribes when the store reports an error', async () => {
        const pending = requestFounderPurchase('habits_lifetime_founder');

        __emitPurchaseError({ code: 'E_USER_CANCELLED' });

        await expect(pending).rejects.toMatchObject({ code: 'E_USER_CANCELLED' });
        expect(__getListenerCounts()).toEqual({ updated: 0, error: 0 });
    });

    it('ignores a purchase update carrying no token', async () => {
        const pending = requestFounderPurchase('habits_lifetime_founder');

        __emitPurchaseUpdate({ id: 'habits_lifetime_founder' });
        expect(__getListenerCounts()).toEqual({ updated: 1, error: 1 });

        __emitPurchaseUpdate({ purchaseToken: 'token-abc' });
        await expect(pending).resolves.toMatchObject({ purchaseToken: 'token-abc' });
    });

    it('ignores an update for a product we did not ask to buy', async () => {
        // The update listener is global and the library replays already-owned
        // and pending purchases through it when the connection opens. Resolving
        // on one of those would send an unrelated token to the verify endpoint.
        const pending = requestFounderPurchase('habits_lifetime_founder');

        __emitPurchaseUpdate({ purchaseToken: 'token-other', id: 'some_other_sku' });
        expect(__getListenerCounts()).toEqual({ updated: 1, error: 1 });

        __emitPurchaseUpdate({ purchaseToken: 'token-abc', id: 'habits_lifetime_founder' });
        await expect(pending).resolves.toMatchObject({ purchaseToken: 'token-abc' });
    });

    it('matches a multi-SKU Android purchase that carries `ids`', async () => {
        const pending = requestFounderPurchase('habits_lifetime_founder');

        __emitPurchaseUpdate({ purchaseToken: 'token-abc', ids: ['habits_lifetime_founder'] });

        await expect(pending).resolves.toMatchObject({ purchaseToken: 'token-abc' });
    });

    it('still settles on a purchase payload carrying no product id at all', async () => {
        // Asymmetric on purpose: an unrecognised shape must not hang the
        // promise forever. A token the server rejects is the lesser failure.
        const pending = requestFounderPurchase('habits_lifetime_founder');

        __emitPurchaseUpdate({ purchaseToken: 'token-abc' });

        await expect(pending).resolves.toMatchObject({ purchaseToken: 'token-abc' });
    });

    it('does NOT finish the transaction as part of the purchase', async () => {
        const pending = requestFounderPurchase('habits_lifetime_founder');
        __emitPurchaseUpdate({ purchaseToken: 'token-abc' });
        await pending;

        // Acknowledging before the server records the purchase would let Play
        // treat it as delivered while the user has nothing.
        expect(finishTransaction).not.toHaveBeenCalled();
    });

    it('acknowledges as a non-consumable when finished explicitly', async () => {
        await finishPurchase({ purchaseToken: 'token-abc' });

        // Consuming it would let the same account buy the lifetime unlock twice.
        expect(finishTransaction).toHaveBeenCalledWith(
            expect.objectContaining({ isConsumable: false }),
        );
    });

    it('asks the store for an in-app product, not a subscription', async () => {
        const pending = requestFounderPurchase('habits_lifetime_founder');
        __emitPurchaseUpdate({ purchaseToken: 'token-abc' });
        await pending;

        expect(requestPurchase).toHaveBeenCalledWith(
            expect.objectContaining({ type: 'in-app' }),
        );
    });

    it('opens the connection once and tolerates repeat calls', async () => {
        await expect(initBilling()).resolves.toBe(true);
        await expect(initBilling()).resolves.toBe(true);
        await endBilling();
    });
});

describe('habitsBilling purchase timeout', () => {
    beforeAll(() => {
        (Platform as any).OS = 'android';
    });

    beforeEach(() => {
        __resetIapMock();
        jest.useFakeTimers();
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    it('rejects with a distinct code when the store never answers', async () => {
        // Without this the promise never settles: the caller's `finally` never
        // runs and the buy button sits disabled reading "Purchasing…".
        const pending = requestFounderPurchase('habits_lifetime_founder');

        jest.advanceTimersByTime(5 * 60 * 1000);

        await expect(pending).rejects.toMatchObject({ code: PURCHASE_TIMEOUT_CODE });
    });

    it('unsubscribes both listeners on timeout', async () => {
        const pending = requestFounderPurchase('habits_lifetime_founder');

        jest.advanceTimersByTime(5 * 60 * 1000);
        await expect(pending).rejects.toBeDefined();

        expect(__getListenerCounts()).toEqual({ updated: 0, error: 0 });
    });

    it('does not time out a purchase that already settled', async () => {
        // A surviving timer would reject a promise that resolved minutes
        // earlier, and an unhandled rejection with it.
        const pending = requestFounderPurchase('habits_lifetime_founder');

        __emitPurchaseUpdate({ purchaseToken: 'token-abc', id: 'habits_lifetime_founder' });
        await expect(pending).resolves.toMatchObject({ purchaseToken: 'token-abc' });

        expect(() => jest.advanceTimersByTime(10 * 60 * 1000)).not.toThrow();
    });

    it('leaves the happy path alone well inside the window', async () => {
        const pending = requestFounderPurchase('habits_lifetime_founder');

        // The Play sheet is a foreground UI the user drives; a few minutes in
        // it is normal and must not be reported as a failure.
        jest.advanceTimersByTime(4 * 60 * 1000);
        __emitPurchaseUpdate({ purchaseToken: 'token-abc', id: 'habits_lifetime_founder' });

        await expect(pending).resolves.toMatchObject({ purchaseToken: 'token-abc' });
    });
});

/**
 * The conversion value reported to Google Ads.
 *
 * This used to be a hardcoded `20 / USD`. It is the number cost-per-payer is
 * judged on, and a wrong one does not look wrong — it looks like a campaign that
 * is doing better or worse than it is, and it is fed straight back into bidding.
 * So: read it from something that knows, and report nothing at all rather than a
 * plausible guess.
 */
describe('resolvePurchaseValue', () => {
    it('reads the verified purchase, which is what Play charged for this order', () => {
        expect(resolvePurchaseValue({
            priceAmountMicros: '20000000',
            priceCurrencyCode: 'USD',
        })).toEqual({ value: 20, currency: 'USD' });
    });

    it('prefers the verified purchase over the price on offer now', () => {
        // A purchase recovered days after a price change was charged the old
        // price. The store only knows the new one.
        const verified = { priceAmountMicros: '20000000', priceCurrencyCode: 'USD' };
        const productOnOfferNow = { priceAmountMicros: '29990000', priceCurrencyCode: 'USD' };

        expect(resolvePurchaseValue(verified, productOnOfferNow)).toEqual({ value: 20, currency: 'USD' });
    });

    it('falls back to the store product when the verify response carries no price', () => {
        expect(resolvePurchaseValue(
            { productId: 'habits_founder_unlock', priceAmountMicros: null, priceCurrencyCode: null },
            { oneTimePurchaseOfferDetails: { priceAmountMicros: '20000000', priceCurrencyCode: 'USD' } },
        )).toEqual({ value: 20, currency: 'USD' });
    });

    it('reports the buyer\'s own currency rather than assuming USD', () => {
        // Play charges in local currency and Google Ads takes `currency` at its
        // word, so labelling €18 as 20 USD overstates revenue silently.
        expect(resolvePurchaseValue({
            priceAmountMicros: '18000000',
            priceCurrencyCode: 'eur',
        })).toEqual({ value: 18, currency: 'EUR' });
    });

    it('keeps the third decimal a three-decimal currency actually uses', () => {
        // BHD, KWD and TND are quoted to thousandths.
        expect(resolvePurchaseValue({
            priceAmountMicros: '7550000',
            priceCurrencyCode: 'KWD',
        })).toEqual({ value: 7.55, currency: 'KWD' });
    });

    it('accepts a normalized numeric price when micros are absent', () => {
        expect(resolvePurchaseValue({ price: 20, currency: 'USD' })).toEqual({ value: 20, currency: 'USD' });
    });

    it.each([
        ['nothing at all', undefined],
        ['null', null],
        ['a purchase with no price fields', { productId: 'habits_founder_unlock' }],
        ['a price with no currency', { priceAmountMicros: '20000000' }],
        ['a currency with no price', { priceCurrencyCode: 'USD' }],
        ['a malformed currency', { priceAmountMicros: '20000000', priceCurrencyCode: 'dollars' }],
        ['a zero price', { priceAmountMicros: '0', priceCurrencyCode: 'USD' }],
        ['an unparseable price', { priceAmountMicros: 'free', priceCurrencyCode: 'USD' }],
    ])('returns null for %s rather than inventing a number', (_label, source: any) => {
        expect(resolvePurchaseValue(source)).toBeNull();
    });

    it('returns null when no source can answer', () => {
        expect(resolvePurchaseValue(null, undefined, {})).toBeNull();
    });
});
