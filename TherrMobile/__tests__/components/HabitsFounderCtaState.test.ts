import { it, describe, expect } from '@jest/globals';
import { shouldShowFounderCta } from '../../main/components/Habits/founderCtaState';

/**
 * The drawer's founder CTA is the one entry point to the offer that is not
 * downstream of a 402, so its visibility rule is the whole feature. Every case
 * below is a way the button could otherwise advertise something the user cannot
 * actually buy.
 */
const buildOffer = (overrides: Partial<any> = {}): any => ({
    productId: 'habits_lifetime_founder',
    total: 5000,
    claimed: 18,
    remaining: 4982,
    isSoldOut: false,
    isEntitled: false,
    purchase: null,
    isStoreConfigured: true,
    ...overrides,
});

describe('shouldShowFounderCta', () => {
    it('shows the CTA while seats remain and the account has not bought in', () => {
        expect(shouldShowFounderCta(buildOffer())).toBe(true);
    });

    describe('hides the CTA', () => {
        it('when the offer has not loaded yet', () => {
            // Also the offline case: the axios interceptor resolves failed GETs
            // with empty data, so `getLifetimeOffer` dispatches nothing and the
            // slice stays null. Failing closed is the point.
            expect(shouldShowFounderCta(null)).toBe(false);
            expect(shouldShowFounderCta(undefined)).toBe(false);
        });

        it('when the account is already entitled', () => {
            // isEntitled is broader than "owns a founder purchase" — it also
            // covers admins and premium subscribers, who must not be re-sold.
            expect(shouldShowFounderCta(buildOffer({ isEntitled: true }))).toBe(false);
        });

        it('when an entitled account has no purchase row of its own', () => {
            // An admin has the entitlement without ever buying; keying off
            // `purchase` instead of `isEntitled` would show them the CTA.
            expect(shouldShowFounderCta(buildOffer({ isEntitled: true, purchase: null }))).toBe(false);
        });

        it('when all 5,000 founder seats are claimed', () => {
            expect(shouldShowFounderCta(buildOffer({
                claimed: 5000,
                remaining: 0,
                isSoldOut: true,
            }))).toBe(false);
        });

        it('when the server has no Play credentials configured', () => {
            // UpgradePaywall hides its own purchase button in this state, so a
            // drawer entry would land the user on a screen with nothing to tap.
            expect(shouldShowFounderCta(buildOffer({ isStoreConfigured: false }))).toBe(false);
        });
    });

    describe('when the sold-out flag and the seat count disagree', () => {
        it('trusts the flag', () => {
            expect(shouldShowFounderCta(buildOffer({ isSoldOut: true, remaining: 12 }))).toBe(false);
        });

        it('trusts the count', () => {
            expect(shouldShowFounderCta(buildOffer({ isSoldOut: false, remaining: 0 }))).toBe(false);
        });

        it('treats a negative count as sold out', () => {
            // The server clamps with Math.max(..., 0), but this helper is the
            // last gate before the user sees the offer and does not depend on it.
            expect(shouldShowFounderCta(buildOffer({ isSoldOut: false, remaining: -3 }))).toBe(false);
        });
    });

    describe('with a malformed payload', () => {
        it('treats a missing seat count as sold out rather than unlimited', () => {
            expect(shouldShowFounderCta(buildOffer({ remaining: undefined }))).toBe(false);
        });

        it('does not accept a numeric string as a seat count', () => {
            expect(shouldShowFounderCta(buildOffer({ remaining: '4982' }))).toBe(false);
        });

        it('rejects NaN', () => {
            expect(shouldShowFounderCta(buildOffer({ remaining: NaN }))).toBe(false);
        });
    });
});
