/**
 * @jest-environment jsdom
 */
import { BrandVariations } from 'therr-js-utilities/constants';
import getBrandAppStore from '../brandAppStores';

describe('getBrandAppStore', () => {
    it('sends a HABITS invite to the Friends with Habits listing', () => {
        const store = getBrandAppStore(BrandVariations.HABITS);

        expect(store.appName).toBe('Friends with Habits');
        expect(store.playStoreUrl).toContain('id=com.therr.habits');
    });

    it('does not offer an App Store badge for HABITS, which has no iOS build', () => {
        // A badge here would install the Therr iOS app, which cannot see a Habits invite.
        expect(getBrandAppStore(BrandVariations.HABITS).appStoreUrl).toBeUndefined();
    });

    it('sends a THERR invite to the Therr listings', () => {
        const store = getBrandAppStore(BrandVariations.THERR);

        expect(store.appName).toBe('Therr');
        expect(store.playStoreUrl).toContain('id=app.therrmobile');
        expect(store.appStoreUrl).toContain('id1569988763');
    });

    it('falls back to Therr for a missing brandVariation', () => {
        // Pre-migration invite rows and expired-token lookups both land here.
        expect(getBrandAppStore(undefined).playStoreUrl).toContain('id=app.therrmobile');
        expect(getBrandAppStore('').playStoreUrl).toContain('id=app.therrmobile');
    });

    it('falls back to Therr for brands with no store listing', () => {
        expect(getBrandAppStore(BrandVariations.TEEM).playStoreUrl).toContain('id=app.therrmobile');
        expect(getBrandAppStore('not-a-real-brand').playStoreUrl).toContain('id=app.therrmobile');
    });

    it('never returns a Therr play listing for a Habits invite', () => {
        // The regression this whole module exists to prevent.
        expect(getBrandAppStore(BrandVariations.HABITS).playStoreUrl).not.toContain('app.therrmobile');
    });
});
