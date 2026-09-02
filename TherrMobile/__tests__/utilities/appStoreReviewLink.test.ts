// Note: import explicitly to use the types shipped with jest.
import { it, describe, expect } from '@jest/globals';

import { getStoreReviewLinks } from '../../main/utilities/appStoreReviewLink';
import { CURRENT_BRAND_VARIATION } from '../../main/config/brandConfig';

/**
 * Store Review Link Tests
 *
 * These assert the *shape* of the links rather than a specific brand's ids, because
 * `brandConfig.ts` is rewritten per niche branch — pinning "app.therrmobile" here would fail
 * the suite on `niche/HABITS-general` for a build that is behaving correctly. What must hold
 * on every branch is that the link points at the brand the binary was built as, and that it
 * opens the review surface rather than the plain listing.
 */

describe('getStoreReviewLinks', () => {
    it('sends Android users to the Play Store app for the current brand', () => {
        const { primary, fallback } = getStoreReviewLinks('android');

        expect(primary).toMatch(/^market:\/\/details\?id=[\w.]+$/);
        expect(fallback).toMatch(/^https:\/\/play\.google\.com\/store\/apps\/details\?id=[\w.]+$/);
    });

    it('asks for the review composer directly on iOS', () => {
        const { primary, fallback } = getStoreReviewLinks('ios');

        expect(primary).toContain('action=write-review');
        expect(fallback).toContain('action=write-review');
        expect(primary).toMatch(/^itms-apps:\/\/itunes\.apple\.com\/app\/id\d+/);
        expect(fallback).toMatch(/^https:\/\/apps\.apple\.com\/app\/id\d+/);
    });

    it('always resolves an iOS listing, even for a brand with no iOS build', () => {
        // A HABITS install IS the Therr iOS binary today, so the Therr listing is the correct
        // place for that user to review. An `idundefined` link here would be a dead end.
        expect(getStoreReviewLinks('ios').primary).not.toContain('undefined');
        expect(getStoreReviewLinks('ios').fallback).not.toContain('undefined');
    });

    it('links the Play listing of the brand this binary was built as', () => {
        const { primary } = getStoreReviewLinks('android');

        expect(primary).toContain(CURRENT_BRAND_VARIATION === 'habits' ? 'com.therr.habits' : 'app.therrmobile');
    });
});
