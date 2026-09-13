import { describe, expect, it } from '@jest/globals';
import formatOrdinal, { getOrdinalCategory } from '../../main/utilities/formatOrdinal';

const KEY = 'pages.leaderboard.placementCard.ordinal';

/**
 * The inline placement card used to render "{placement}th" in English, which reads "21th" and
 * "22th" for anyone past twentieth. The suffix is a plural rule that differs per locale, so it
 * is looked up from the dictionary by the category `Intl.PluralRules` assigns.
 */
describe('formatOrdinal', () => {
    it('picks the English suffix by ordinal category, including the teens and the twenties', () => {
        expect(formatOrdinal('en-us', 1, KEY)).toBe('1st');
        expect(formatOrdinal('en-us', 2, KEY)).toBe('2nd');
        expect(formatOrdinal('en-us', 3, KEY)).toBe('3rd');
        expect(formatOrdinal('en-us', 4, KEY)).toBe('4th');
        expect(formatOrdinal('en-us', 11, KEY)).toBe('11th');
        expect(formatOrdinal('en-us', 12, KEY)).toBe('12th');
        expect(formatOrdinal('en-us', 13, KEY)).toBe('13th');
        expect(formatOrdinal('en-us', 21, KEY)).toBe('21st');
        expect(formatOrdinal('en-us', 22, KEY)).toBe('22nd');
        expect(formatOrdinal('en-us', 23, KEY)).toBe('23rd');
        expect(formatOrdinal('en-us', 111, KEY)).toBe('111th');
    });

    it('renders the other locales in their own forms', () => {
        expect(formatOrdinal('fr-ca', 1, KEY)).toBe('1er');
        expect(formatOrdinal('fr-ca', 21, KEY)).toBe('21e');
        expect(formatOrdinal('es', 21, KEY)).toBe('21.º');
    });

    it('falls back to the common form for a category the dictionary has no entry for', () => {
        // No shipped dictionary is missing a category (locale parity forbids it), so exercise
        // the fallback through a prefix that only defines `other`.
        expect(formatOrdinal('en-us', 21, 'pages.celebration.placement')).toBe('pages.celebration.placement.other');
    });

    it('degrades to the common form rather than throwing on a malformed locale tag', () => {
        expect(getOrdinalCategory('!!', 21)).toBe('other');
    });
});
