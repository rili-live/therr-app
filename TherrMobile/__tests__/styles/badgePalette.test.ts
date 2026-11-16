// Note: import explicitly to use the types shipped with jest.
import { it, describe, expect } from '@jest/globals';
import Color from 'color';
import { BrandVariations } from 'therr-js-utilities/constants';
import { achievementClassesByBrand } from 'therr-js-utilities/config';

import {
    BADGE_PALETTE_CLASSES,
    getBadgeStateColors,
    getBadgeTone,
} from '../../main/styles/achievements/badgePalette';
import { getTheme } from '../../main/styles/themes';

/**
 * The achievement badges' own palette. It exists because the theme had too few distinct
 * hues to tell eleven ladders apart, so what it has to guarantee is exactly that — distinct
 * hues — plus a glyph that can be read on every one of them, in both themes.
 */
const themes = (['light', 'dark'] as const).map((name) => ({ name, colors: getTheme(name, BrandVariations.HABITS).colors }));
const habitsClasses = Array.from(achievementClassesByBrand[BrandVariations.HABITS]);
const contrast = (a: string, b: string) => new Color(a).contrast(new Color(b));

describe('badgePalette', () => {
    it('has a hue for every class the Habits brand can earn', () => {
        habitsClasses.forEach((achievementClass) => {
            expect({ achievementClass, hasHue: BADGE_PALETTE_CLASSES.includes(achievementClass) })
                .toEqual({ achievementClass, hasHue: true });
        });
    });

    it.each(themes)('keeps every class visibly apart on the $name theme', ({ colors }) => {
        const hues = habitsClasses.map((achievementClass) => ({
            achievementClass,
            color: new Color(getBadgeTone(achievementClass, colors).from),
        }));

        hues.forEach((a, index) => {
            hues.slice(index + 1).forEach((b) => {
                const hueGap = Math.abs(a.color.hue() - b.color.hue());
                const wrappedGap = Math.min(hueGap, 360 - hueGap);
                const saturationGap = Math.abs(a.color.saturationl() - b.color.saturationl());

                // Two classes may share a neighbourhood of the wheel only if one is plainly
                // greyer than the other (the brand's muted purple beside orchid; slate beside sky).
                expect({ pair: `${a.achievementClass}/${b.achievementClass}`, distinct: wrappedGap >= 15 || saturationGap >= 15 })
                    .toEqual({ pair: `${a.achievementClass}/${b.achievementClass}`, distinct: true });
            });
        });
    });

    it.each(themes)('holds 3:1 between the glyph and the card in every state on the $name theme', ({ colors }) => {
        habitsClasses.forEach((achievementClass) => {
            const tone = getBadgeTone(achievementClass, colors);

            (['earned', 'inProgress'] as const).forEach((state) => {
                const palette = getBadgeStateColors(state, tone, colors);
                // WCAG 1.4.11 (non-text contrast), against the lighter end of the ground.
                const ratio = Math.min(contrast(palette.ink, palette.groundFrom), contrast(palette.ink, palette.groundTo));

                expect({ achievementClass, state, passes: ratio >= 3 }).toEqual({ achievementClass, state, passes: true });
            });
        });
    });

    it('paints an unknown class in the brand colour rather than nothing', () => {
        const { colors } = themes[0];

        expect(getBadgeTone('somethingNew', colors).from.toLowerCase()).toBe(new Color(colors.brand).hex().toLowerCase());
    });

    it('gives a locked card no hue at all', () => {
        themes.forEach(({ colors }) => {
            const palette = getBadgeStateColors('locked', getBadgeTone('dailyStreak', colors), colors);

            expect(new Color(palette.groundFrom).saturationl()).toBeLessThan(12);
            expect(palette.glowOpacity).toBe(0);
        });
    });
});
