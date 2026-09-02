import Color from 'color';

/**
 * Journal color coding.
 *
 * The journal merges six kinds of row from every habit the user keeps, so a
 * long day reads as an undifferentiated stack of text. Color splits it two
 * ways at once, along axes that do not compete:
 *
 *   - **Hue says which habit.** Every row belonging to a habit — its notes,
 *     check-ins, milestones and the day it started — draws from the same slot
 *     in this palette, so a user scanning a month sees their running entries as
 *     one color and their reading entries as another.
 *   - **Icon says what happened.** The glyph in the tinted disc is chosen by
 *     row type, not by habit, so type never has to fight hue for the same slot.
 *
 * WHY HUES AND NOT HEX
 * --------------------
 * A fixed hex palette can only be legible against one background. This app has
 * three themes plus per-brand palette overrides (`brandColorOverrides` in
 * `styles/themes/index.ts`), which means the surface a journal row sits on is
 * white on one theme, near-black on another and a mid-tone teal on a third —
 * and a niche branch may change it again without touching this file. So a
 * swatch is stored as a hue and resolved against the actual surface at
 * `buildStyles` time: `pickLegibleLightness` sweeps the lightness axis and
 * takes the value nearest the theme's ideal that still clears `MIN_CONTRAST`.
 * Hue and saturation are never touched, so the colors stay distinguishable from
 * each other while every one of them stays readable.
 *
 * On a mid-luminance surface (retro's teal `#1a6d76`) no lightness inside the
 * clamp clears 4.5:1, and the sweep falls back to the most contrasting value it
 * can reach — pastels around 4.2–5.1:1. That is the honest best available
 * rather than a silent regression to unreadable text, and it is unreachable on
 * Friends with Habits anyway: `resolveMobileThemeName` maps retro to dark for
 * HABITS, which is the only brand that renders the journal.
 *
 * This module is deliberately free of React Native and of app types — it takes
 * and returns plain strings — so the color math is unit-testable
 * (`__tests__/styles/JournalPalette.test.ts`).
 */

export interface IJournalSwatch {
    /** Icon, rule and label color. Legible on the surface it was built for. */
    accent: string;
    /**
     * Opaque wash of `accent` over that surface, for chip and disc fills.
     *
     * Opaque rather than an alpha of `accent`, because these fills stack on a
     * card that is itself painted `surface`; a translucent fill would shift
     * again wherever the card sits on something else.
     */
    tint: string;
}

/** Non-habit rows: a goal post, an achievement, or an untagged note. */
export interface IJournalTypePalette {
    goal: IJournalSwatch;
    achievement: IJournalSwatch;
    neutral: IJournalSwatch;
}

/**
 * Eight hues, spread far enough apart to stay separable at chip size and in the
 * common forms of color-blindness — no two adjacent slots differ by hue alone
 * in the red/green axis. Eight is also comfortably above the habit count the
 * app allows most users, so a typical journal never repeats a color.
 */
const JOURNAL_HUES = [174, 205, 252, 292, 330, 8, 34, 140];

export const JOURNAL_PALETTE_SIZE = JOURNAL_HUES.length;

const HABIT_SATURATION = 62;

// Where the sweep would like to land: dark text on a light surface, light text
// on a dark one. It moves off these only as far as contrast requires.
const IDEAL_LIGHTNESS_ON_LIGHT = 42;
const IDEAL_LIGHTNESS_ON_DARK = 68;

// The sweep never leaves this band. Outside it a hue washes out to near-white
// or crushes to near-black and stops reading as a color at all, which would
// defeat the point — better a slightly under-contrasted teal than eight
// identical whites.
const MIN_LIGHTNESS = 26;
const MAX_LIGHTNESS = 88;

/** WCAG AA for normal-size text, which the habit chip label is. */
const MIN_CONTRAST = 4.5;

const TINT_WEIGHT_ON_LIGHT = 0.13;
const TINT_WEIGHT_ON_DARK = 0.2;

const surfaceProfile = (surface: Color) => (surface.isDark()
    ? { idealLightness: IDEAL_LIGHTNESS_ON_DARK, tintWeight: TINT_WEIGHT_ON_DARK }
    : { idealLightness: IDEAL_LIGHTNESS_ON_LIGHT, tintWeight: TINT_WEIGHT_ON_LIGHT });

/**
 * The lightness closest to `idealLightness` that clears `MIN_CONTRAST` against
 * `surface`; when nothing in the band clears it, the most contrasting value the
 * band allows.
 *
 * A full sweep rather than a step-until-it-passes loop because the relationship
 * is not monotonic on a mid-tone surface — contrast falls, bottoms out and
 * rises again as lightness crosses the surface's own — so stepping in one
 * direction would stop at the worst possible value.
 */
const pickLegibleLightness = (
    hue: number,
    saturation: number,
    idealLightness: number,
    surface: Color,
): Color => {
    let best: Color | null = null;
    let bestContrast = 0;
    let bestDistance = Number.MAX_SAFE_INTEGER;

    for (let lightness = MIN_LIGHTNESS; lightness <= MAX_LIGHTNESS; lightness += 1) {
        // Rounded to the hex it will be stored as before its contrast is read.
        // Measuring the full-precision HSL and shipping the 8-bit hex loses up
        // to 0.03 of ratio, which is enough to ship a swatch that misses the
        // target it was selected for.
        const candidate = new Color(Color.hsl(hue, saturation, lightness).hex());
        const contrast = candidate.contrast(surface);
        const distance = Math.abs(lightness - idealLightness);
        const passes = contrast >= MIN_CONTRAST;
        const bestPasses = bestContrast >= MIN_CONTRAST;

        // A passing candidate always beats a failing one; between two passing
        // candidates the one nearer the theme's ideal wins; between two failing
        // ones, whichever is more readable.
        const isBetter = (!best)
            || (passes && !bestPasses)
            || (passes && bestPasses && distance < bestDistance)
            || (!passes && !bestPasses && contrast > bestContrast);

        if (isBetter) {
            best = candidate;
            bestContrast = contrast;
            bestDistance = distance;
        }
    }

    return best as Color;
};

const buildSwatch = (hue: number, saturation: number, surface: Color): IJournalSwatch => {
    const { idealLightness, tintWeight } = surfaceProfile(surface);

    // The accent is solved against the *tint*, not against the surface, because
    // the tint is what it is actually drawn on — an icon inside its disc, a
    // label inside its chip. Solving against the surface leaves those pairings
    // around 3.7:1, since the fill has already moved the background toward the
    // accent's own hue.
    //
    // The tint is therefore derived from the hue at its ideal lightness rather
    // than from the accent, which breaks the circularity: a fixed background to
    // solve against, in one pass. Because the tint sits between the surface and
    // the accent, clearing the target against it also clears it against the
    // surface, so the card and the chip are both covered.
    const tint = new Color(
        surface.mix(Color.hsl(hue, saturation, idealLightness), tintWeight).hex(),
    );
    const accent = pickLegibleLightness(hue, saturation, idealLightness, tint);

    return {
        accent: accent.hex(),
        tint: tint.hex(),
    };
};

/**
 * The habit palette, resolved against the surface journal rows are painted on.
 *
 * Cheap enough to run inside `buildStyles` (eight hues x a 63-step sweep, once
 * per screen construction) and deliberately not cached, so a theme or brand
 * change is picked up without an invalidation path to get wrong.
 */
export const buildJournalPalette = (entrySurface: string): IJournalSwatch[] => {
    const surface = new Color(entrySurface);

    return JOURNAL_HUES.map((hue) => buildSwatch(hue, HABIT_SATURATION, surface));
};

/**
 * The same legibility treatment for a color that comes from the theme rather
 * than from the hue table — the brand purple behind goal rows, the accent gold
 * behind achievements.
 *
 * These need it more than the hue table does, not less: `colors.brand` is
 * chosen to look right in app chrome, and on Friends with Habits it lands at
 * 2.8:1 on the dark theme's surface. Taking its hue and saturation and letting
 * the sweep place the lightness keeps the brand recognizable and readable at
 * the same time.
 */
export const buildJournalThemeSwatch = (source: string, entrySurface: string): IJournalSwatch => {
    const surface = new Color(entrySurface);
    const hsl = new Color(source).hsl();

    return buildSwatch(hsl.hue(), hsl.saturationl(), surface);
};

/**
 * FNV-1a. Any stable string hash would do; this one is short, has no
 * dependencies and spreads uuid-shaped keys evenly across eight buckets.
 */
const hashKey = (key: string): number => {
    let hash = 2166136261;

    for (let i = 0; i < key.length; i += 1) {
        // eslint-disable-next-line no-bitwise
        hash ^= key.charCodeAt(i);
        hash = Math.imul(hash, 16777619);
    }

    // eslint-disable-next-line no-bitwise
    return hash >>> 0;
};

/**
 * Assign each of the user's habits a palette slot.
 *
 * Hashing alone is not enough: four habits hashed into eight slots collide
 * about 35% of the time, and two habits sharing a color is precisely the thing
 * this feature exists to prevent. So the hash picks a preferred slot and
 * collisions probe forward to the next free one — every currently-kept habit
 * gets a distinct color, while each one keeps the same color across renders,
 * app launches and devices for as long as the habit list is unchanged.
 *
 * Ordering matters only for tie-breaking, so pass the habit list in whatever
 * stable order the server returned it.
 */
export const buildJournalSwatchAssignment = (habitGoalIds: string[]): Record<string, number> => {
    const assignment: Record<string, number> = {};
    const taken = new Set<number>();

    habitGoalIds.forEach((habitGoalId) => {
        if (!habitGoalId || assignment[habitGoalId] !== undefined) {
            return;
        }

        const preferred = hashKey(habitGoalId) % JOURNAL_PALETTE_SIZE;
        let slot = preferred;

        for (let probe = 0; probe < JOURNAL_PALETTE_SIZE && taken.has(slot); probe += 1) {
            slot = (preferred + probe + 1) % JOURNAL_PALETTE_SIZE;
        }

        assignment[habitGoalId] = slot;
        taken.add(slot);
    });

    return assignment;
};

/**
 * Look up a habit's slot, falling back to its bare hash.
 *
 * The fallback is the common case for archived habits: they still own entries
 * far back in the journal but no longer appear in the habit list, so there is
 * nothing to assign them a probed slot. It also covers the first frames after
 * mount, where the feed can arrive before the habit list does.
 */
export const getJournalSwatchIndex = (
    habitGoalId: string,
    assignment: Record<string, number>,
): number => {
    const assigned = assignment[habitGoalId];

    return assigned === undefined ? hashKey(habitGoalId) % JOURNAL_PALETTE_SIZE : assigned;
};

/**
 * The swatch one journal row draws in.
 *
 * Habit wins whenever there is one, so a check-in, its note and the milestone
 * it produced all share a color. Rows that belong to no habit fall back to a
 * color that describes what they are: goals to the brand, achievements to the
 * accent, and everything else — an untagged note — to neutral, which is what
 * keeps the palette meaning "habit" rather than decorating every row.
 *
 * Structurally typed rather than taking `IJournalFeedItem`, to keep this module
 * importable by a test without pulling in the compiled `therr-react` bundle.
 */
export const resolveJournalSwatch = (
    item: { type?: string; habitGoalId?: string | null },
    palette: IJournalSwatch[],
    typePalette: IJournalTypePalette,
    assignment: Record<string, number>,
): IJournalSwatch => {
    if (item.habitGoalId) {
        return palette[getJournalSwatchIndex(item.habitGoalId, assignment)];
    }

    if (item.type === 'goal') {
        return typePalette.goal;
    }

    if (item.type === 'achievement') {
        return typePalette.achievement;
    }

    return typePalette.neutral;
};
