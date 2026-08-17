import {
    it, describe, expect, beforeAll, beforeEach,
} from '@jest/globals';
import { Platform } from 'react-native';
import {
    endBilling,
    finishPurchase,
    initBilling,
    isBillingSupported,
    requestFounderPurchase,
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
