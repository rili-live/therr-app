import 'react-native';
import React from 'react';
import renderer, { act } from 'react-test-renderer';
import {
    it, describe, expect, jest, beforeEach,
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
        endBilling: jest.fn(() => Promise.resolve()),
        initBilling: jest.fn(() => Promise.resolve(true)),
        isBillingSupported: jest.fn(() => true),
        fetchFounderProduct: jest.fn(() => Promise.resolve({
            displayPrice: '$19.99',
            oneTimePurchaseOfferDetails: { priceAmountMicros: '19990000', priceCurrencyCode: 'USD' },
        })),
        fetchPremiumProduct: jest.fn(() => Promise.resolve({
            displayPrice: '$6.99',
            subscriptionOfferDetails: [{
                offerToken: 'offer-token',
                pricingPhases: { pricingPhaseList: [{ priceAmountMicros: '6990000', priceCurrencyCode: 'USD' }] },
            }],
        })),
        getSubscriptionOfferToken: jest.fn(() => 'offer-token'),
        getOwnedFounderPurchase: jest.fn(() => Promise.resolve(null)),
        getOwnedSubscription: jest.fn(() => Promise.resolve(null)),
    };
});

import { UpgradePaywall } from '../../main/routes/Habits/UpgradePaywall';

/**
 * The redesigned paywall: one founder hero card, one quieter monthly card, and
 * "Not now" as a text link rather than a second brand-coloured button. These
 * check what each state puts on screen — the founder CTA, the seat count, the
 * value anchor, the sold-out fallback — through the rendered text, since the
 * point of the redesign is what the user reads.
 */

const LIFETIME_OFFER = {
    productId: 'habits_founder_unlock',
    total: 5000,
    claimed: 18,
    remaining: 4982,
    isSoldOut: false,
    isEntitled: false,
    purchase: null,
    isStoreConfigured: true,
};

const PREMIUM_OFFER = {
    productId: 'habits_premium_monthly',
    isEntitled: false,
    subscription: null,
    isStoreConfigured: true,
    isBrandSupported: true,
};

const buildProps = (overrides: any = {}) => ({
    user: { settings: { locale: 'en-us' }, details: { id: 'user-1' } },
    habits: { lifetimeOffer: LIFETIME_OFFER, premiumOffer: PREMIUM_OFFER },
    navigation: { goBack: jest.fn(), setOptions: jest.fn() },
    route: { params: {} },
    getLifetimeOffer: jest.fn(() => Promise.resolve(LIFETIME_OFFER)),
    getPremiumOffer: jest.fn(() => Promise.resolve(PREMIUM_OFFER)),
    verifyLifetimePurchase: jest.fn(() => Promise.resolve(null)),
    verifyPremiumPurchase: jest.fn(() => Promise.resolve(null)),
    getMe: jest.fn(() => Promise.resolve(null)),
    ...overrides,
});

// Walks the rendered JSON rather than `findAllByType(Text)` — app code resolves
// `react-native` through the local resolver proxy, so a `Text` imported here is a
// different module instance and never matches.
const getTextLines = (component: renderer.ReactTestRenderer): string[] => {
    const lines: string[] = [];

    const walk = (node: any) => {
        if (!node || typeof node === 'string') {
            return;
        }
        if (Array.isArray(node)) {
            node.forEach(walk);
            return;
        }
        if (node.type === 'Text') {
            const text = (node.children || [])
                .filter((child: any) => typeof child === 'string')
                .join('');
            if (text) {
                lines.push(text);
            }
        }
        (node.children || []).forEach(walk);
    };

    walk(component.toJSON());

    return lines;
};

const findButtons = (component: renderer.ReactTestRenderer) => component.root.findAll(
    (node: any) => node.props?.accessibilityRole === 'button' && typeof node.props?.onPress === 'function',
);

const renderPaywall = async (props: any) => {
    let component: any;

    await act(async () => {
        component = renderer.create(<UpgradePaywall {...props} />);
    });
    // Let the offer fetch and the store product reads settle.
    await act(async () => {
        await Promise.resolve();
    });

    return component as renderer.ReactTestRenderer;
};

describe('UpgradePaywall — redesigned layout', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('leads with the founder offer, its real price and the live seat count', async () => {
        const component = await renderPaywall(buildProps());
        const lines = getTextLines(component);

        expect(lines).toContain('$19.99');
        expect(lines).toContain('Unlock for life · $19.99');
        expect(lines).toContain('4,982 of 5,000 founder spots left');
        // The monthly plan is present but secondary, with its own price.
        expect(lines).toContain('Monthly');
        expect(lines).toContain('$6.99');
        expect(lines).toContain('Subscribe · $6.99');
        // 19.99 / 6.99 → "less than 3 months".
        expect(lines).toContain('Founder access costs less than 3 months of the monthly plan.');
    });

    it('renders "Not now" as a link, not as a second primary button', async () => {
        const props = buildProps();
        const component = await renderPaywall(props);
        const notNow = findButtons(component).find(
            (node: any) => node.findAll((child: any) => child.props?.children === 'Not now').length > 0,
        );

        expect(notNow).toBeDefined();
        // Style is a function of pressed state; resolve it un-pressed.
        const style = notNow!.props.style({ pressed: false });
        const flat = Object.assign({}, ...(Array.isArray(style) ? style.filter(Boolean) : [style]));
        expect(flat.backgroundColor).toBeUndefined();

        await act(async () => {
            notNow!.props.onPress();
        });
        expect(props.navigation.goBack).toHaveBeenCalledTimes(1);
    });

    it('shows the limit meter with one pip per free slot when sent here by a 402', async () => {
        const component = await renderPaywall(buildProps({
            route: { params: { reason: 'habit-limit-reached', limit: 5 } },
        }));
        const lines = getTextLines(component);

        expect(lines).toContain("You've reached the free limit");
        expect(lines).toContain('All 5 free slots in use');
        // Host nodes only: the composite `View` and its host child both carry the label.
        const meter = component.root.findAll(
            (node: any) => node.type === 'View' && node.props?.accessibilityLabel === 'All 5 free slots in use',
        );
        expect(meter).toHaveLength(1);
        // The pips are the meter's non-Text children.
        const pips = meter[0].props.children[0];
        expect(pips).toHaveLength(5);
    });

    it('drops the founder CTA but keeps the card when the offer is sold out, and promotes monthly', async () => {
        const soldOut = {
            ...LIFETIME_OFFER, claimed: 5000, remaining: 0, isSoldOut: true,
        };
        const component = await renderPaywall(buildProps({
            habits: { lifetimeOffer: soldOut, premiumOffer: PREMIUM_OFFER },
            getLifetimeOffer: jest.fn(() => Promise.resolve(soldOut)),
        }));
        const lines = getTextLines(component);

        expect(lines).toContain('All founder spots have been claimed.');
        expect(lines.some((line) => line.startsWith('Unlock for life'))).toBe(false);
        expect(lines).toContain('Subscribe · $6.99');
        // No anchor line: there is nothing to anchor against.
        expect(lines.some((line) => line.includes('costs less than'))).toBe(false);
    });

    it('tells an entitled founder their number and offers only a way out', async () => {
        const owned = {
            ...LIFETIME_OFFER, isEntitled: true, purchase: { founderNumber: 42 },
        };
        const component = await renderPaywall(buildProps({
            habits: { lifetimeOffer: owned, premiumOffer: { ...PREMIUM_OFFER, isEntitled: true } },
            getLifetimeOffer: jest.fn(() => Promise.resolve(owned)),
        }));
        const lines = getTextLines(component);

        expect(lines).toContain("You're all set");
        expect(lines).toContain('You are founder #42.');
        expect(lines.some((line) => line.startsWith('Unlock for life'))).toBe(false);
        expect(lines.some((line) => line.startsWith('Subscribe'))).toBe(false);
        expect(findButtons(component)).toHaveLength(1);
    });

    it('still offers a way back when neither offer loaded', async () => {
        const component = await renderPaywall(buildProps({
            habits: { lifetimeOffer: null, premiumOffer: null },
            getLifetimeOffer: jest.fn(() => Promise.reject(new Error('offline'))),
            getPremiumOffer: jest.fn(() => Promise.reject(new Error('offline'))),
        }));
        const lines = getTextLines(component);

        expect(lines).toContain('This offer is not available on your device right now.');
        expect(findButtons(component)).toHaveLength(1);
    });
});
