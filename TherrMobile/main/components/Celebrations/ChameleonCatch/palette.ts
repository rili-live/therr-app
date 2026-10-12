import Color from 'color';
import { ITherrThemeColors } from '../../../styles/themes';

/**
 * Every colour in the scene, derived from the active theme once per theme change (never per
 * frame). The mixes follow the approved spec:
 *
 * - The skin walks brand purple → teal → lime as the taps land, and gold on the catch.
 * - The set (stick, leaves, hill, rock) is mixed from brand constants and from `onSurface` /
 *   `backgroundGray`, so it recedes on both the light and the dark ground.
 * - The theme has no brown, so the bark is `brandingOrange` taken halfway to `brandingBlack`, and
 *   lifted on a dark ground so the stick does not sink into it.
 * - The rock is lit from above-left in every theme: its facets mix toward white and black from a
 *   mid-grey body, never toward the ground (which would flip the lighting on a dark one).
 * - Gold result text is darkened on a light ground; the bright accent there is under 3:1.
 */

const mix = (from: string, to: string, share: number) => new Color(from).mix(new Color(to), share).hex();

/** Index into every skin-keyed list below: purple, teal, lime, gold. */
export const SKIN_STOPS = [0, 1, 2, 3];
export const GOLD_SKIN = 3;

export interface IScenePalette {
    skins: string[];
    /** The far limbs: each skin with a little of the brand black in it. */
    shades: string[];
    /** The eye turret stands proud of the head, a shade lighter than the skin. */
    turrets: string[];
    /** The gold stripe, lightened once the skin itself turns gold. */
    stripes: string[];
    eyeWhite: string;
    ink: string;
    tongue: string;
    bark: string;
    barkUnderside: string;
    leaves: [string, string];
    hill: string;
    rock: string;
    rockLight: string;
    rockDark: string;
    /** The crack opens onto the screen's own ground. */
    crack: string;
    gems: string[];
    /** The XP and rarity label of an epic or jackpot, readable on the screen's ground. */
    resultGold: string;
}

export const getScenePalette = (colors: ITherrThemeColors): IScenePalette => {
    const skins = [colors.brand, colors.accentTeal, colors.accentLime, colors.accent];
    const isDarkGround = new Color(colors.backgroundGray).isDark();
    const brown = mix(colors.brandingOrange, colors.brandingBlack, 0.5);
    const bark = isDarkGround ? mix(brown, colors.brandingWhite, 0.3) : brown;
    const setTone = mix(colors.brandDark, colors.onSurface, 0.3);
    const rock = mix(colors.onSurface, colors.backgroundGray, 0.5);

    return {
        skins,
        shades: skins.map((skin) => mix(skin, colors.brandingBlack, 0.28)),
        turrets: skins.map((skin) => mix(skin, colors.brandingWhite, 0.12)),
        stripes: [colors.accent, colors.accent, colors.accent, mix(colors.accent, colors.brandingWhite, 0.55)],
        eyeWhite: colors.brandingWhite,
        ink: colors.brandingBlack,
        tongue: mix(colors.accentRed, colors.brand, 0.3),
        bark,
        barkUnderside: mix(bark, colors.brandingBlack, 0.3),
        leaves: [mix(colors.accentLime, colors.brandingBlack, 0.15), mix(colors.accentLime, colors.brandingBlack, 0.3)],
        hill: mix(setTone, colors.backgroundGray, 0.8),
        rock,
        rockLight: mix(rock, colors.brandingWhite, 0.3),
        rockDark: mix(rock, colors.brandingBlack, 0.2),
        crack: colors.backgroundGray,
        gems: [colors.accentTeal, colors.accent, colors.accentLime, colors.brand],
        resultGold: isDarkGround ? colors.accent : mix(colors.accent, colors.brandingBlack, 0.35),
    };
};
