import {
    it, describe, expect, beforeEach, jest,
} from '@jest/globals';

jest.mock('@react-native-firebase/analytics', () => ({
    __esModule: true,
    getAnalytics: jest.fn(() => ({})),
    logEvent: jest.fn(() => Promise.resolve()),
}));

jest.mock('../../main/utilities/habitsBilling', () => {
    const actual: any = jest.requireActual('../../main/utilities/habitsBilling');

    return {
        __esModule: true,
        ...actual,
        // The native side of the wrapper is not what this file is about; the
        // value resolution is, so it stays real.
        finishPurchase: jest.fn(() => Promise.resolve()),
        endBilling: jest.fn(() => Promise.resolve()),
        initBilling: jest.fn(() => Promise.resolve(true)),
        isBillingSupported: jest.fn(() => true),
        fetchFounderProduct: jest.fn(() => Promise.resolve(null)),
        getOwnedFounderPurchase: jest.fn(() => Promise.resolve(null)),
    };
});

import { logEvent } from '@react-native-firebase/analytics';
import { UpgradePaywall } from '../../main/routes/Habits/UpgradePaywall';

/**
 * `habits_founder_unlock_purchase` is the only in-app answer to whether paid
 * acquisition can fund itself, and it is imported into Google Ads as a VALUE
 * conversion — the amount is fed back into bidding.
 *
 * It used to carry a hardcoded `value: 20, currency: 'USD'`, which is right only
 * for a US buyer at today's price. These lock in the two rules that replaced it:
 * take the amount from something that knows it, and send no amount at all rather
 * than a plausible wrong one.
 */
const PURCHASE: any = {
    purchaseToken: 'token-1',
    orderId: 'order-1',
    rawPurchase: { id: 'habits_founder_unlock' },
};

const buildInstance = (verifyResponse: any) => {
    const props: any = {
        user: { settings: {}, details: { id: 'user-1' } },
        habits: { lifetimeOffer: { productId: 'habits_founder_unlock' } },
        navigation: { goBack: jest.fn(), setOptions: jest.fn() },
        route: { params: {} },
        verifyLifetimePurchase: jest.fn(() => Promise.resolve(verifyResponse)),
        getLifetimeOffer: jest.fn(() => Promise.resolve(null)),
        getMe: jest.fn(() => Promise.resolve(null)),
    };

    const instance = new UpgradePaywall(props);
    instance.setState = jest.fn();

    return { instance, props };
};

const getPurchaseEvent = () => (logEvent as jest.Mock).mock.calls
    .find((call: any[]) => call[1] === 'habits_founder_unlock_purchase');

describe('habits_founder_unlock_purchase conversion value', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('reports what Play actually charged, from the verified purchase', async () => {
        const { instance } = buildInstance({
            purchase: { priceAmountMicros: '20000000', priceCurrencyCode: 'USD' },
        });

        await instance.verifyAndFinish(PURCHASE);

        expect(getPurchaseEvent()?.[2]).toMatchObject({
            userId: 'user-1',
            value: 20,
            currency: 'USD',
            isRecovery: false,
        });
    });

    it('reports a non-US buyer in their own currency', async () => {
        const { instance } = buildInstance({
            purchase: { priceAmountMicros: '18000000', priceCurrencyCode: 'EUR' },
        });

        await instance.verifyAndFinish(PURCHASE);

        expect(getPurchaseEvent()?.[2]).toMatchObject({ value: 18, currency: 'EUR' });
    });

    it('falls back to the store product when the server returned no price', async () => {
        const { instance } = buildInstance({ purchase: { productId: 'habits_founder_unlock' } });
        (instance as any).storeProduct = {
            oneTimePurchaseOfferDetails: { priceAmountMicros: '20000000', priceCurrencyCode: 'USD' },
        };

        await instance.verifyAndFinish(PURCHASE);

        expect(getPurchaseEvent()?.[2]).toMatchObject({ value: 20, currency: 'USD' });
    });

    it('sends the conversion with no amount when nothing knows the price', async () => {
        // A count is still worth having. A guessed amount is not — it looks
        // right and is fed straight back into bidding.
        const { instance } = buildInstance({ purchase: { productId: 'habits_founder_unlock' } });

        await instance.verifyAndFinish(PURCHASE);

        const params = getPurchaseEvent()?.[2];

        expect(params).toBeDefined();
        expect(params).not.toHaveProperty('value');
        expect(params).not.toHaveProperty('currency');
        expect(params).toMatchObject({ userId: 'user-1', isRecovery: false });
    });

    it('marks the recovery path so a late verify is not read as a fresh sale', async () => {
        const { instance } = buildInstance({
            purchase: { priceAmountMicros: '20000000', priceCurrencyCode: 'USD' },
        });

        await instance.verifyAndFinish(PURCHASE, { isSilent: true });

        expect(getPurchaseEvent()?.[2]).toMatchObject({ isRecovery: true });
    });

    it('records nothing when verification fails, because no money was confirmed', async () => {
        const { instance, props } = buildInstance(null);
        props.verifyLifetimePurchase.mockImplementation(() => Promise.reject(new Error('rejected')));

        await instance.verifyAndFinish(PURCHASE);

        expect(getPurchaseEvent()).toBeUndefined();
    });
});
