import { BrandVariations } from 'therr-js-utilities/constants';
import { CURRENT_BRAND_VARIATION } from '../../main/config/brandConfig';
import { buildInviteUrl, isShareableUserName } from '../../main/utilities/shareUrls';

// Brand-relative, like shareUrls.test.ts: the expectation follows whatever brandConfig.ts selects.
const isHabits = CURRENT_BRAND_VARIATION === BrandVariations.HABITS;
const genericInvite = isHabits ? /\/invite\/link$/ : /\/invite$/;

describe('shareUrls', () => {
    describe('buildInviteUrl', () => {
        it('links to the inviter by username when there is one', () => {
            expect(buildInviteUrl('en-us', 'zizzle6717')).toMatch(/\/invite\/zizzle6717$/);
            expect(buildInviteUrl('en-us', 'first.last_name')).toMatch(/\/invite\/first\.last_name$/);
        });

        // Regression: habits.therr.com received sessions on /invite/null — accounts without a
        // username yet shared `/invite/${null}`.
        it('never produces /invite/null or /invite/undefined', () => {
            [null, undefined, 'null', 'undefined'].forEach((userName) => {
                const url = buildInviteUrl('en-us', userName as any);

                expect(url).not.toMatch(/null|undefined/);
                expect(url).toMatch(genericInvite);
            });
        });

        it('falls back to the generic invite landing, not /invite/, for an empty username', () => {
            // `/invite/` hard-404d on habits.therr.com; callers that coalesce to '' produced it.
            expect(buildInviteUrl('en-us', '')).toMatch(genericInvite);
        });

        // Regression: a bare /invite 404s on habits.therr.com until the web route that accepts it
        // deploys, and the Play build can ship first. /invite/link is the generic landing on the
        // web build in production and on the one replacing it, so the link works in either order.
        it('falls back to a generic landing the production web already serves', () => {
            expect(buildInviteUrl('en-us', null)).toBe(
                isHabits ? 'https://habits.therr.com/invite/link' : 'https://www.therr.com/invite',
            );
        });

        it('does not put a username the landing cannot resolve into the path', () => {
            expect(buildInviteUrl('en-us', 'has space')).toMatch(genericInvite);
            expect(buildInviteUrl('en-us', '../etc')).toMatch(genericInvite);
        });
    });

    describe('isShareableUserName', () => {
        it('accepts what sanitizeUserName produces', () => {
            expect(isShareableUserName('abc')).toBe(true);
            expect(isShareableUserName('a.b_c1')).toBe(true);
        });

        it('rejects missing values and their stringified forms', () => {
            expect(isShareableUserName(null)).toBe(false);
            expect(isShareableUserName(undefined)).toBe(false);
            expect(isShareableUserName('')).toBe(false);
            expect(isShareableUserName('null')).toBe(false);
            expect(isShareableUserName('undefined')).toBe(false);
        });
    });
});
