/**
 * Drift guard between the two places that answer "what is this app called".
 *
 * `BRAND_NAMES` (therr-js-utilities) exists so the *gateway* can name a brand from nothing but
 * the `x-brand-variation` header. `hostContext` (this service) carries the far richer per-brand
 * config and is keyed by host. They are deliberately separate — the gateway cannot reach
 * `hostContext` — but they both feed user-facing copy, and a Friends with Habits user who gets
 * "Friends with Habits" in the verification SMS and "Therr" in the invite email is looking at
 * exactly the inconsistency this whole change set was meant to remove.
 *
 * The assertion is scoped to brands that have their *own* `hostContext` entry. Most
 * `BrandVariations` members (appy-social, parallels, otaku) are placeholders with no entry at
 * all and fall back to the Therr context, so requiring them to match would assert that an
 * unbuilt brand is named Therr — which is not an invariant, just an artifact of the fallback.
 * The real risk is the opposite direction: someone adds or renames a dedicated context for a
 * niche app and leaves `BRAND_NAMES` behind.
 */
import { expect } from 'chai';
import { BrandVariations, getBrandName } from 'therr-js-utilities/constants';
import hostContext, { getHostContext } from '../../src/constants/hostContext';

const therrContext = hostContext['therr.com'];

describe('brand name sources stay in sync', () => {
    const brandsWithDedicatedContext = Object.values(BrandVariations)
        .filter((brand) => getHostContext('', brand) !== therrContext);

    it('covers at least the niche brands that ship today', () => {
        // Guards the filter itself: if `getHostContext` stops resolving these by brand, every
        // assertion below would vacuously pass.
        expect(brandsWithDedicatedContext).to.include(BrandVariations.HABITS);
        expect(brandsWithDedicatedContext).to.include(BrandVariations.TEEM);
    });

    brandsWithDedicatedContext.forEach((brand) => {
        it(`names '${brand}' identically in BRAND_NAMES and its hostContext`, () => {
            expect(getBrandName(brand)).to.equal(getHostContext('', brand).brandShortName);
        });
    });

    it('agrees on Therr, which every other brand falls back to', () => {
        expect(getBrandName(BrandVariations.THERR)).to.equal(therrContext.brandShortName);
    });

    it('gives every brand variation a name rather than silently falling back', () => {
        // `getBrandName` falls back to Therr for anything it does not know, which is right for
        // an unrecognized header but wrong for a brand we ship — it would put the wrong app
        // name in front of that brand's users with no error anywhere.
        Object.values(BrandVariations)
            .filter((brand) => brand !== BrandVariations.THERR && brand !== BrandVariations.DASHBOARD_THERR)
            .forEach((brand) => {
                expect(getBrandName(brand), `${brand} has no BRAND_NAMES entry`).to.not.equal('Therr');
            });
    });
});
