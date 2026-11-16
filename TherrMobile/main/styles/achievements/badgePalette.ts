import Color from 'color';
import { ITherrThemeColors } from '../themes';

/**
 * Colour for the Friends with Habits achievement badges.
 *
 * The badges used to borrow whichever theme slots were free, and five of the eleven
 * classes landed on near-identical purples (`brand`, `brandDark`, `accentBlue`,
 * `accentPurple`, `accentAlt`) — with two of them resolving to the very same hex. In a
 * list that was survivable; in a grid, where colour is the first thing that tells one
 * ladder from the next, it is not. The theme has no slots for eleven distinct hues, so the
 * badges carry a palette of their own.
 *
 * The hues are spread round the wheel and held to one saturation/lightness band so they
 * sit together as a set beside the brand's muted purple and gold. Two classes stay on
 * theme tokens on purpose: `accountability` (pacts are the product) wears the brand colour,
 * and `weeklyChampion` wears the brand's gold accent.
 *
 * Every `from` holds at least 3:1 against the white glyph drawn on it (WCAG 1.4.11,
 * non-text contrast) — `__tests__/styles/badgePalette.test.ts` checks it.
 */

export interface IBadgeTone {
    /** Top-left of the card's gradient, and the class's identifying colour. */
    from: string;
    /** Bottom-right of the gradient. */
    to: string;
}

interface IBadgeHue {
    from: string;
    to: string;
}

const CLASS_HUES: { [achievementClass: string]: IBadgeHue } = {
    cleanBreak: { from: '#6474D8', to: '#4350A8' }, // indigo
    consistency: { from: '#2F8FC4', to: '#1F6A9C' }, // sky
    dailyStreak: { from: '#DC6A32', to: '#B44A1C' }, // ember
    habitBuilder: { from: '#2F9460', to: '#1F7049' }, // leaf
    pactPioneer: { from: '#BC5796', to: '#8F376E' }, // berry
    resilience: { from: '#66758C', to: '#465264' }, // slate
    socialEnergizer: { from: '#DA5A70', to: '#B03C54' }, // coral
    socialite: { from: '#9A68CC', to: '#7446A8' }, // orchid
    treasureBuilder: { from: '#1F9488', to: '#166F68' }, // jade
};

const deepen = (color: string) => new Color(color).darken(0.26).hex();

/** The two classes that follow the theme rather than the fixed palette. */
const themedTone = (achievementClass: string, colors: ITherrThemeColors): IBadgeTone | null => {
    if (achievementClass === 'weeklyChampion') {
        return { from: new Color(colors.accent).darken(0.12).hex(), to: new Color(colors.accent).darken(0.38).hex() };
    }
    if (achievementClass === 'accountability') {
        return { from: new Color(colors.brand).hex(), to: deepen(colors.brand) };
    }
    return null;
};

export const BADGE_PALETTE_CLASSES = [...Object.keys(CLASS_HUES), 'accountability', 'weeklyChampion'];

/**
 * The gradient a class's badge is painted in. An unknown class — one added to
 * `therr-js-utilities` before it is given a hue here — gets the brand colour rather
 * than nothing.
 */
export const getBadgeTone = (achievementClass: string, colors: ITherrThemeColors): IBadgeTone => {
    const themed = themedTone(achievementClass, colors);
    if (themed) {
        return themed;
    }

    const hue = CLASS_HUES[achievementClass];
    if (hue) {
        return hue;
    }

    return { from: new Color(colors.brand).hex(), to: deepen(colors.brand) };
};

const mix = (from: string, to: string, share: number) => new Color(from).mix(new Color(to), share).hex();

export interface IBadgeStateColors {
    /** Gradient stops for the card ground. Equal stops paint a flat ground. */
    groundFrom: string;
    groundTo: string;
    /** The glyph, and the level numeral where it sits on the ground. */
    ink: string;
    /** Inset keyline that finishes the card's edge. */
    keyline: string;
    keylineOpacity: number;
    /** The pool of light behind the glyph. Opacity 0 for none. */
    glow: string;
    glowOpacity: number;
}

/**
 * An earned badge is the class colour at full strength. One still being worked toward is
 * the same card with the colour drained to a tint of the surface behind it — recognisably
 * the badge you are earning, and unmistakably not earned yet. A locked badge has no hue at
 * all. Both unearned grounds are mixed from the surface, so they hold up on the dark theme
 * instead of fading to a pale patch the way a lowered opacity did.
 */
export const getBadgeStateColors = (
    state: 'earned' | 'inProgress' | 'locked',
    tone: IBadgeTone,
    colors: ITherrThemeColors,
): IBadgeStateColors => {
    if (state === 'earned') {
        return {
            groundFrom: tone.from,
            groundTo: tone.to,
            ink: colors.brandingWhite,
            keyline: colors.brandingWhite,
            keylineOpacity: 0.34,
            glow: colors.brandingWhite,
            glowOpacity: 0.3,
        };
    }

    const surface = new Color(colors.surface);
    const isDarkSurface = surface.isDark();

    if (state === 'inProgress') {
        return {
            groundFrom: mix(tone.from, colors.surface, isDarkSurface ? 0.72 : 0.86),
            groundTo: mix(tone.from, colors.surface, isDarkSurface ? 0.62 : 0.74),
            // The deep stop reads on a pale tint; on a dark one it would sink, so lift it.
            ink: isDarkSurface ? new Color(tone.from).lighten(0.28).hex() : tone.to,
            keyline: tone.from,
            keylineOpacity: isDarkSurface ? 0.6 : 0.42,
            // White lifts a pale tint; on a dark one it fogs the glyph, so the light is the
            // class colour instead.
            glow: isDarkSurface ? tone.from : colors.brandingWhite,
            glowOpacity: isDarkSurface ? 0.3 : 0.55,
        };
    }

    const neutral = isDarkSurface ? colors.brandingWhite : colors.brandingBlack;

    return {
        groundFrom: mix(neutral, colors.surface, 0.9),
        groundTo: mix(neutral, colors.surface, 0.84),
        ink: mix(neutral, colors.surface, 0.66),
        keyline: neutral,
        keylineOpacity: 0.1,
        glow: neutral,
        glowOpacity: 0,
    };
};
