import { it, describe, expect } from '@jest/globals';
import Color from 'color';
import {
    buildJournalPalette,
    buildJournalSwatchAssignment,
    buildJournalThemeSwatch,
    getJournalSwatchIndex,
    JOURNAL_PALETTE_SIZE,
    resolveJournalSwatch,
} from '../../main/styles/habits/journalPalette';

/**
 * The journal's habit palette.
 *
 * Two properties carry the whole feature and neither is visible in a snapshot:
 * the colors have to stay *legible* on whichever surface the active theme
 * paints a journal card, and they have to stay *distinct* from each other so
 * two habits never read as one. Both are computed rather than authored, so they
 * are asserted here against real theme surfaces rather than eyeballed once.
 */

// The surface each theme paints a journal entry card in — `colors.surface` from
// styles/themes/{light,dark,retro}. Copied rather than imported so a palette
// regression is reported here as a contrast failure, instead of being masked by
// the same theme change that caused it.
const SURFACES = {
    light: '#ffffff',
    dark: '#1E1E1E',
    retro: '#1a6d76',
};

const contrast = (a: string, b: string) => new Color(a).contrast(new Color(b));

describe('journal palette legibility', () => {
    it.each([
        ['light', SURFACES.light],
        ['dark', SURFACES.dark],
    ])('clears WCAG AA against the %s theme surface', (_name, surface) => {
        buildJournalPalette(surface).forEach((swatch) => {
            expect(contrast(swatch.accent, surface)).toBeGreaterThanOrEqual(4.5);
            // The accent is also drawn on its own tint (icon in a disc, label in
            // a chip), which is the tighter of the two pairings.
            expect(contrast(swatch.accent, swatch.tint)).toBeGreaterThanOrEqual(4.5);
        });
    });

    it('still keeps the accent readable on a mid-luminance surface', () => {
        // Retro's teal surface is close enough to mid-gray that no lightness of
        // a saturated hue reaches 4.5:1. The sweep is expected to fall back to
        // the most contrasting value inside the band — the point of the
        // assertion is that it lands on something readable rather than
        // collapsing to near-black, which an unclamped search does.
        buildJournalPalette(SURFACES.retro).forEach((swatch) => {
            expect(contrast(swatch.accent, SURFACES.retro)).toBeGreaterThan(3);
        });
    });

    it('rescues a brand color that is unreadable on its own surface', () => {
        // Friends with Habits' brand purple sits at 2.8:1 on the dark theme's
        // surface, which is why goal rows cannot simply paint `colors.brand`.
        const brand = '#6E5C85';
        expect(contrast(brand, SURFACES.dark)).toBeLessThan(4.5);

        const swatch = buildJournalThemeSwatch(brand, SURFACES.dark);
        expect(contrast(swatch.accent, SURFACES.dark)).toBeGreaterThanOrEqual(4.5);
        // ...without becoming a different color: only lightness moves, so the
        // hue survives to within 8-bit rounding.
        expect(Math.abs(new Color(swatch.accent).hue() - new Color(brand).hue())).toBeLessThan(5);
    });

    it('keeps a neutral seed neutral rather than inventing a hue', () => {
        const swatch = buildJournalThemeSwatch('rgba(0,0,0,.58)', SURFACES.light);

        expect(new Color(swatch.accent).saturationl()).toBe(0);
        expect(contrast(swatch.accent, SURFACES.light)).toBeGreaterThanOrEqual(4.5);
    });

    it('produces visibly different colors in every slot', () => {
        const accents = buildJournalPalette(SURFACES.light).map((swatch) => swatch.accent);

        expect(new Set(accents).size).toBe(JOURNAL_PALETTE_SIZE);
    });
});

/**
 * Two ids that hash to the same slot, searched for rather than hardcoded so the
 * probing test keeps testing probing if the hash function is ever swapped.
 * Eight slots make a collision certain within nine candidates.
 */
const findCollidingIds = (): [string, string] => {
    const seen: Record<number, string> = {};

    for (let i = 0; i < 100; i += 1) {
        const id = `habit-${i}`;
        const slot = getJournalSwatchIndex(id, {});

        if (seen[slot]) {
            return [seen[slot], id];
        }

        seen[slot] = id;
    }

    throw new Error('expected a hash collision within 100 ids across 8 slots');
};

describe('journal swatch assignment', () => {
    // Enough habits to fill the palette, which is where collisions live.
    const habitIds = Array.from({ length: JOURNAL_PALETTE_SIZE }, (_, i) => `habit-${i}`);

    it('gives every habit its own slot', () => {
        const assignment = buildJournalSwatchAssignment(habitIds);
        const slots = habitIds.map((id) => assignment[id]);

        expect(new Set(slots).size).toBe(JOURNAL_PALETTE_SIZE);
    });

    it('probes past a collision instead of letting two habits share a color', () => {
        const [first, second] = findCollidingIds();
        expect(getJournalSwatchIndex(first, {})).toBe(getJournalSwatchIndex(second, {}));

        const assignment = buildJournalSwatchAssignment([first, second]);
        expect(assignment[first]).not.toBe(assignment[second]);
        // The first one keeps the slot it wanted; only the loser moves.
        expect(assignment[first]).toBe(getJournalSwatchIndex(first, {}));
    });

    it('returns the same slot for the same habit on every build', () => {
        expect(buildJournalSwatchAssignment(habitIds))
            .toEqual(buildJournalSwatchAssignment(habitIds));
    });

    it('ignores duplicates and empty ids rather than burning slots on them', () => {
        const assignment = buildJournalSwatchAssignment(['habit-a', 'habit-a', '']);

        expect(Object.keys(assignment)).toEqual(['habit-a']);
    });

    it('falls back to a stable slot for a habit missing from the list', () => {
        // Archived habits still own entries deep in the journal but no longer
        // appear in the habit list, so they are never assigned one.
        const first = getJournalSwatchIndex('archived-habit', {});
        const second = getJournalSwatchIndex('archived-habit', {});

        expect(first).toBe(second);
        expect(first).toBeGreaterThanOrEqual(0);
        expect(first).toBeLessThan(JOURNAL_PALETTE_SIZE);
    });

    it('keeps every slot inside the palette, however long the habit list gets', () => {
        // Past eight habits colors necessarily repeat; what must not happen is
        // an out-of-range index, which reaches the row as an undefined swatch.
        const many = Array.from({ length: JOURNAL_PALETTE_SIZE * 3 }, (_, i) => `habit-${i}`);
        const assignment = buildJournalSwatchAssignment(many);

        many.forEach((id) => {
            const slot = getJournalSwatchIndex(id, assignment);
            expect(slot).toBeGreaterThanOrEqual(0);
            expect(slot).toBeLessThan(JOURNAL_PALETTE_SIZE);
        });
    });
});

describe('resolveJournalSwatch', () => {
    const palette = buildJournalPalette(SURFACES.light);
    const typePalette = {
        goal: buildJournalThemeSwatch('#6E5C85', SURFACES.light),
        achievement: buildJournalThemeSwatch('#D49617', SURFACES.light),
        neutral: buildJournalThemeSwatch('rgba(0,0,0,.58)', SURFACES.light),
    };
    const assignment = buildJournalSwatchAssignment(['habit-a', 'habit-b']);
    const resolve = (item: any) => resolveJournalSwatch(item, palette, typePalette, assignment);

    it('prefers the habit color over the row type', () => {
        // A check-in and a milestone for one habit must match each other, not
        // each other's type — that is what makes a habit scannable down a month.
        expect(resolve({ type: 'checkin', habitGoalId: 'habit-a' }))
            .toEqual(resolve({ type: 'milestone', habitGoalId: 'habit-a' }));
    });

    it('separates two habits', () => {
        expect(resolve({ type: 'checkin', habitGoalId: 'habit-a' }).accent)
            .not.toBe(resolve({ type: 'checkin', habitGoalId: 'habit-b' }).accent);
    });

    it('falls back to the type palette for rows that belong to no habit', () => {
        expect(resolve({ type: 'goal', habitGoalId: null })).toEqual(typePalette.goal);
        expect(resolve({ type: 'achievement', habitGoalId: null })).toEqual(typePalette.achievement);
        expect(resolve({ type: 'note', habitGoalId: null })).toEqual(typePalette.neutral);
    });
});
