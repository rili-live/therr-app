import { it, describe, expect } from '@jest/globals';

import {
    formatSeatCount,
    getFounderValueAnchorMonths,
    getSeatFillRatio,
} from '../../main/routes/Habits/paywallPresentation';

const oneTime = (micros: string, currency = 'USD') => ({
    oneTimePurchaseOfferDetails: { priceAmountMicros: micros, priceCurrencyCode: currency },
});

const monthly = (micros: string, currency = 'USD') => ({
    subscriptionOfferDetails: [{
        pricingPhases: { pricingPhaseList: [{ priceAmountMicros: micros, priceCurrencyCode: currency }] },
    }],
});

/**
 * The paywall's "founder costs less than N months of monthly" line is only
 * worth showing when it is true and stated in one currency. These pin the
 * cases where it must stay silent.
 */
describe('getFounderValueAnchorMonths', () => {
    it('rounds the ratio up, so the claim is never an understatement', () => {
        // 19.99 / 6.99 = 2.86 → "less than 3 months" is true; "2 months" would not be.
        expect(getFounderValueAnchorMonths(oneTime('19990000'), monthly('6990000'))).toBe(3);
    });

    it('states an exact multiple as itself', () => {
        expect(getFounderValueAnchorMonths(oneTime('20000000'), monthly('5000000'))).toBe(4);
    });

    it('stays silent when the two prices are in different currencies', () => {
        // We have no exchange rate, and a wrong number here is worse than none.
        expect(getFounderValueAnchorMonths(oneTime('19990000', 'USD'), monthly('6990000', 'EUR'))).toBeNull();
    });

    it('stays silent when either price is unknown', () => {
        expect(getFounderValueAnchorMonths(null, monthly('6990000'))).toBeNull();
        expect(getFounderValueAnchorMonths(oneTime('19990000'), null)).toBeNull();
        expect(getFounderValueAnchorMonths(undefined, undefined)).toBeNull();
    });

    it('stays silent when the founder unlock is cheaper than one month', () => {
        // Ceil would give 1 — "less than 1 month" is a claim nobody believes.
        expect(getFounderValueAnchorMonths(oneTime('4990000'), monthly('6990000'))).toBe(1);
        expect(getFounderValueAnchorMonths(oneTime('0'), monthly('6990000'))).toBeNull();
    });
});

describe('getSeatFillRatio', () => {
    it('is the claimed share of the total', () => {
        expect(getSeatFillRatio({ claimed: 2500, total: 5000 })).toBe(0.5);
    });

    it('is empty for an offer nobody has bought yet', () => {
        expect(getSeatFillRatio({ claimed: 0, total: 5000 })).toBe(0);
    });

    it('keeps a claimed seat visible rather than rounding it away', () => {
        // 18 / 5000 is 0.36% — invisible at any card width.
        expect(getSeatFillRatio({ claimed: 18, total: 5000 })).toBe(0.03);
    });

    it('never overflows the track', () => {
        expect(getSeatFillRatio({ claimed: 6000, total: 5000 })).toBe(1);
    });

    it('is empty for a malformed offer', () => {
        expect(getSeatFillRatio(null)).toBe(0);
        expect(getSeatFillRatio({ claimed: NaN, total: 5000 })).toBe(0);
        expect(getSeatFillRatio({ claimed: 10, total: 0 })).toBe(0);
        expect(getSeatFillRatio({ claimed: -3, total: 5000 })).toBe(0);
    });
});

describe('formatSeatCount', () => {
    it('groups thousands for the locale', () => {
        expect(formatSeatCount(4982, 'en-us')).toBe('4,982');
    });

    it('is empty for a missing count rather than "undefined"', () => {
        expect(formatSeatCount(undefined, 'en-us')).toBe('');
        expect(formatSeatCount(null, 'en-us')).toBe('');
        expect(formatSeatCount(NaN, 'en-us')).toBe('');
    });
});
