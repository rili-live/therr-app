import { it, describe, expect } from '@jest/globals';
import { BrandVariations } from 'therr-js-utilities/constants';
import { CURRENT_BRAND_VARIATION } from '../../main/config/brandConfig';
import {
    buildAchievementsShareUrl,
    buildInviteUrl,
    buildShareUrl,
} from '../../main/utilities/shareUrls';

/**
 * Brand-relative: the expectations follow whatever `brandConfig.ts` selects, so the
 * suite passes on `general` and on `niche/HABITS-general` and fails when a share link
 * points at the wrong property for the app that minted it.
 */
const isHabits = CURRENT_BRAND_VARIATION === BrandVariations.HABITS;
const origin = isHabits ? 'https://habits.therr.com' : 'https://www.therr.com';

describe('shareUrls', () => {
    it(`builds links on ${origin} for ${CURRENT_BRAND_VARIATION}`, () => {
        expect(buildInviteUrl('en-us', 'zack')).toBe(`${origin}/invite/zack`);
    });

    it('prefixes the locale only where the host serves localised pages', () => {
        // habits.therr.com serves one fixed set of English pages and hard-404s anything
        // else, so a locale prefix there is a dead link; therr.com is locale-routed.
        expect(buildShareUrl('es', '/invite/zack')).toBe(
            isHabits ? `${origin}/invite/zack` : `${origin}/es/invite/zack`,
        );
        expect(buildShareUrl('fr-ca', '/spaces/abc')).toBe(
            isHabits ? `${origin}/spaces/abc` : `${origin}/fr-ca/spaces/abc`,
        );
    });

    it('sends an achievement share somewhere that exists on this brand\'s host', () => {
        // therr.com has an /achievements deep link; the habits host does not, so the
        // landing page is the destination there.
        expect(buildAchievementsShareUrl('en-us')).toBe(isHabits ? `${origin}/` : `${origin}/achievements`);
        expect(buildAchievementsShareUrl('es')).toBe(isHabits ? `${origin}/` : `${origin}/es/achievements`);
    });
});
