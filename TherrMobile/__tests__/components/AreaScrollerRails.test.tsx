import 'react-native';

// Note: import explicitly to use the types shipped with jest.
import { it, describe, expect, beforeEach, afterEach } from '@jest/globals';

import { getPlaceholderIconName } from '../../main/components/UserContent/BrandedMediaPlaceholder';
import { getScrollerCardWidth } from '../../main/components/UserContent/HorizontalCardScroller';

/**
 * Area detail rail tests.
 *
 * Covers the two pure helpers behind the horizontal card rails that replaced the
 * stacked sub-lists on the area detail screens (Local Pairings, Upcoming Events,
 * Guest Posts):
 *
 *  - `getScrollerCardWidth` decides how much of the next card peeks in, which is
 *    the only affordance telling the user a rail scrolls. A regression that
 *    returns the full viewport width silently removes it.
 *  - `getPlaceholderIconName` picks the glyph for the branded placeholder shown
 *    when content has no media, and must never resolve to the Therr logo mark —
 *    that glyph is brand identity and these components render on every variant.
 */

beforeEach(() => {
    jest.useFakeTimers();
});

afterEach(() => {
    jest.clearAllMocks();
    jest.clearAllTimers();
});

describe('getScrollerCardWidth', () => {
    it('should leave room for the next card to peek in on a typical phone', () => {
        const viewportWidth = 390;
        const width = getScrollerCardWidth(viewportWidth);

        expect(width).toBeLessThan(viewportWidth);
        // The peek plus the rail's edge inset must clear a finger target.
        expect(viewportWidth - width).toBeGreaterThan(40);
    });

    it('should not shrink below the minimum on a very narrow viewport', () => {
        expect(getScrollerCardWidth(240)).toBe(210);
    });

    it('should cap the card width on a tablet-sized viewport', () => {
        expect(getScrollerCardWidth(1024)).toBe(300);
    });

    it('should return an integer so cards align to whole pixels', () => {
        [320, 375, 390, 412, 428, 768].forEach((viewportWidth) => {
            expect(Number.isInteger(getScrollerCardWidth(viewportWidth))).toBe(true);
        });
    });

    it('should grow monotonically with the viewport', () => {
        const widths = [240, 320, 390, 480, 600, 1024].map(getScrollerCardWidth);
        widths.forEach((width, index) => {
            if (index > 0) {
                expect(width).toBeGreaterThanOrEqual(widths[index - 1]);
            }
        });
    });
});

describe('getPlaceholderIconName', () => {
    it('should map food-ish categories to the utensils glyph', () => {
        expect(getPlaceholderIconName('categories.restaurant')).toBe('utensils');
        expect(getPlaceholderIconName('categories.cafe')).toBe('utensils');
        expect(getPlaceholderIconName('categories.food/drink')).toBe('utensils');
    });

    it('should map the remaining known category groups', () => {
        expect(getPlaceholderIconName('categories.nightlife/bar')).toBe('cocktail');
        expect(getPlaceholderIconName('categories.discount')).toBe('gift');
        expect(getPlaceholderIconName('categories.retail')).toBe('storefront');
        expect(getPlaceholderIconName('categories.music')).toBe('music');
        expect(getPlaceholderIconName('categories.outdoor')).toBe('walking');
        expect(getPlaceholderIconName('categories.event')).toBe('calendar');
    });

    it('should fall back to the area type when the category is unknown', () => {
        expect(getPlaceholderIconName('categories.somethingBrandNew', 'events')).toBe('calendar');
        expect(getPlaceholderIconName('categories.somethingBrandNew', 'moments')).toBe('camera');
        expect(getPlaceholderIconName('categories.somethingBrandNew', 'spaces')).toBe('storefront');
    });

    it('should use the area type when there is no category at all', () => {
        expect(getPlaceholderIconName(undefined, 'moments')).toBe('camera');
        expect(getPlaceholderIconName('', 'events')).toBe('calendar');
    });

    it('should fall back to a neutral glyph when nothing is known', () => {
        expect(getPlaceholderIconName()).toBe('map');
        expect(getPlaceholderIconName(undefined, 'somethingElse')).toBe('map');
    });

    it('should never resolve to the Therr logo mark', () => {
        const inputs: [string | undefined, string | undefined][] = [
            [undefined, undefined],
            ['', ''],
            ['categories.restaurant', 'spaces'],
            ['categories.unknown', 'unknown'],
        ];

        inputs.forEach(([category, areaType]) => {
            expect(getPlaceholderIconName(category, areaType)).not.toBe('therr-logo');
        });
    });
});
