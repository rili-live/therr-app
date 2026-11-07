import Color from 'color';
import { CompanionStageId } from '../../utilities/companionGrowth';

/**
 * Pixel-art sprites for the habit companion chameleon, one per growth stage.
 *
 * Every sprite is a 24x24 grid drawn on the same canvas with the branch on the same rows, so
 * stepping from one stage to the next reads as the chameleon growing in place rather than
 * as a different picture. Each character is one pixel; `.` is transparent and every other
 * character is a key into a palette (below). Keep every row exactly SPRITE_SIZE characters —
 * the companion test fails otherwise.
 *
 * Body pixels use the `G`/`L`/`D` (body / highlight / shade) keys so a skin can recolor the
 * chameleon without redrawing it — that is how tapping it "changes color". Every key resolves
 * to a theme token in getCompanionPalette, so the art follows the brand and light/dark theme.
 *
 * The branch (`B`/`b`) is drawn into each sprite so the art reads whole here, but is split
 * out at render time (getCreatureRows / BRANCH_ROWS) so the chameleon can bob and hop while
 * the branch stays put.
 */

export const SPRITE_SIZE = 24;

export const COMPANION_SPRITES: Record<CompanionStageId, ReadonlyArray<string>> = {
    egg: [
        '........................',
        '........................',
        '........................',
        '........................',
        '........................',
        '........................',
        '........................',
        '........................',
        '........................',
        '..........KKKK..........',
        '........KKSSSSKK........',
        '.......KSWSSSSSSK.......',
        '......KSWSPPSSSSSK......',
        '......KSSSPPSSSSSK......',
        '.....KSSSSSSSSPPSSK.....',
        '.....KSSSSSSSSPPSsK.....',
        '.....KSPPSSSSSSSSsK.....',
        '.....KSPPSSSSSSSSsK.....',
        '......KSSSSSPPSSsK......',
        '......KsSSSSPPSssK......',
        '.......KKssssssKK.......',
        'BBBBBBBBBKKKKKKBBBBBBBBB',
        'bbbbbbbbbbbbbbbbbbbbbbbb',
        '........................',
    ],
    hatchling: [
        '........................',
        '........................',
        '........................',
        '........................',
        '........................',
        '........................',
        '........................',
        '............KKK.........',
        '..........KKLLLKK.......',
        '.........KLLGGGLLK......',
        '........KLGGKKKGGLK.....',
        '........KGGKLWEKGGLK....',
        '........KGGKLEEKGGGK....',
        '.......KKGGGKKKGGKKKK...',
        '.....KKSKGGGGGGGRGK.K...',
        '.....KSSSKKGGGGGGKSSK...',
        '.....KSPSSSKKKKKKSSsK...',
        '.....KSPPSSSSSPPSSssK...',
        '......KSSSSSSSPPSssK....',
        '......KsSSSSSSSSsssK....',
        '.......KKssssssssKK.....',
        'BBBBBBBBBKKKKKKKKBBBBBBB',
        'bbbbbbbbbbbbbbbbbbbbbbbb',
        '........................',
    ],
    juvenile: [
        '........................',
        '........................',
        '........................',
        '........................',
        '........................',
        '........................',
        '........................',
        '........................',
        '........................',
        '........................',
        '..............KKK.......',
        '............KKLLLKK.....',
        '..........KKLLGGGLLK....',
        '.........KLLGGGKKKGLK...',
        '........KLGDGGKLWEKGLK..',
        '.......KGGDGGGKLEEKGGK..',
        '....KKKGGDGGGGGKKKGKKK..',
        '...KGGGGGGGGGGGGGRGK....',
        '..KGKKKYYYYYYYYYYK......',
        '..KGKGKKDDDDDDDDK.......',
        '..KGGGKKLDLKKLDLK.......',
        'BBBKKKBBKKKBBKKKBBBBBBBB',
        'bbbbbbbbbbbbbbbbbbbbbbbb',
        '........................',
    ],
    adult: [
        '........................',
        '........................',
        '........................',
        '........................',
        '........................',
        '........................',
        '...............KKK......',
        '..............KLLLKK....',
        '...........KKKLGGGLLK...',
        '.........KKLLLGGGGGGLK..',
        '........KLLGGGGGKKKGGLK.',
        '.......KLGDGGDGKLWEKGGLK',
        '......KLGGDGGDGKLEEKGGGK',
        '......KGGGDGGDGGKKKGGKKK',
        '..KKKKGGGGDGGDGGGGGGGGK.',
        '.KGGGGGGGGDGGDGGGGGRGK..',
        'KGKKKKGGGGGGGGGGGGGGK...',
        'KGKGGKYYYYYYYYYYYYYK....',
        'KGKKGKKDDDDDDDDDDDK.....',
        'KGGGGK.KGGK...KGGK......',
        '.KKKK.KLDDLK.KLDDLK.....',
        'BBBBBBBKKKKBBBKKKKBBBBBB',
        'bbbbbbbbbbbbbbbbbbbbbbbb',
        '........................',
    ],
    champion: [
        '........................',
        '........................',
        '.....C........K.K.K..C..',
        '....CCC......KCKCKCKCCC.',
        '.....C.......KCCCCCK.C..',
        '.............KcCcCcK....',
        '...C...........KKK......',
        '..CCC.........KLLLKK....',
        '...C.......KKKLGGGLLK...',
        '.........KKLLLGGGGGGLK..',
        '.C......KLLGGTGGKKKGGLK.',
        'CCC....KLGOGGTGKLWEKGGLK',
        '.C....KLGGOGGTGKLEEKGGGK',
        '......KUGGOGGTGGKKKGGKKK',
        '..KKKKGUGGOGGTGGGGGGGGK.',
        '.KGGGGGUGGOGGTGGGGGRGKC.',
        'KGKKKKGUGGOGGTGGGGGGKCCC',
        'KGKGGKYYYYYYYYYYYYYK..C.',
        'KGKKGKKDDDDDDDDDDDK.....',
        'KGGGGK.KGGK...KGGK......',
        '.KKKK.KLDDLK.KLDDLK.....',
        'BBBBBBBKKKKBBBKKKKBBBBBB',
        'bbbbbbbbbbbbbbbbbbbbbbbb',
        '........................',
    ],
};

const BRANCH_KEYS = /[Bb]/g;

/** A sprite with its branch pixels made transparent — the layer that animates. */
export const getCreatureRows = (rows: ReadonlyArray<string>): string[] => rows.map((row) => row.replace(BRANCH_KEYS, '.'));

/** The static branch layer drawn behind every stage: a full-width bough on rows 21-22. */
export const BRANCH_ROWS: ReadonlyArray<string> = Array.from({ length: SPRITE_SIZE }, (_, y) => {
    if (y === 21) return 'B'.repeat(SPRITE_SIZE);
    if (y === 22) return 'b'.repeat(SPRITE_SIZE);
    return '.'.repeat(SPRITE_SIZE);
});

/** The theme colors the palette is mixed from — a subset of ITherrThemeColors. */
export interface ICompanionThemeColors {
    brand: string;
    accent: string;
    accentTeal: string;
    accentLime: string;
    accentRed: string;
    brandingBlack: string;
    brandingWhite: string;
    brandingOrange: string;
    surface: string;
}

const mix = (from: string, to: string, share: number) => new Color(from).mix(new Color(to), share).hex();

/**
 * The skins a tap walks through: green (the resting color) → teal → gold → brand. The same
 * four theme tokens as the daily-bonus chameleon reveal, starting from green because a
 * chameleon at rest reads as green — the brand purple is one tap away. Nothing here hardcodes
 * a color, so the skins follow the brand and the light/dark theme.
 */
export const getCompanionSkins = (colors: ICompanionThemeColors): string[] => [
    colors.accentLime,
    colors.accentTeal,
    colors.accent,
    colors.brand,
];

export const COMPANION_SKIN_COUNT = 4;
const GOLD_SKIN_INDEX = 2;

/**
 * Resolves every sprite key to a color for the given theme and skin. Shading is mixed from
 * the skin itself (toward white for the highlight, toward the brand black for the shade) so
 * every skin is lit the same way.
 */
export const getCompanionPalette = (colors: ICompanionThemeColors, skinIndex: number = 0): { [key: string]: string } => {
    const skins = getCompanionSkins(colors);
    const resolvedSkinIndex = ((skinIndex % skins.length) + skins.length) % skins.length;
    const skin = skins[resolvedSkinIndex];
    const isGoldSkin = resolvedSkinIndex === GOLD_SKIN_INDEX;
    const isDarkGround = new Color(colors.surface).isDark();
    const brown = mix(colors.brandingOrange, colors.brandingBlack, 0.5);
    // Lift the bark on a dark ground so the branch does not sink into it.
    const bark = isDarkGround ? mix(brown, colors.brandingWhite, 0.3) : brown;

    return {
        G: skin, // body
        L: mix(skin, colors.brandingWhite, 0.35), // highlight
        D: mix(skin, colors.brandingBlack, 0.28), // shade
        K: mix(colors.brandingBlack, skin, 0.15), // outline
        // The mascot's gold stripe; lightened once the skin itself turns gold.
        Y: isGoldSkin ? mix(colors.accent, colors.brandingWhite, 0.55) : colors.accent,
        W: colors.brandingWhite, // eye highlight / egg shine
        E: colors.brandingBlack, // pupil
        R: mix(colors.accentRed, colors.brandingWhite, 0.45), // cheek
        B: bark, // branch
        b: mix(bark, colors.brandingBlack, 0.3), // branch underside
        S: '#F6EED8', // eggshell
        s: '#D9C8A0', // eggshell shade
        P: mix(colors.accentLime, colors.brandingWhite, 0.3), // eggshell spots — a hint of what is inside
        O: colors.accent, // champion bands
        T: colors.accentTeal,
        // The brand color, not lime: a lime band would vanish on the resting green body.
        U: colors.brand,
        C: colors.accent, // crown / sparkles
        c: mix(colors.accent, colors.brandingBlack, 0.3), // crown shade
    };
};

/**
 * Collapses a sprite into one SVG path per color, merging each horizontal run of same-colored
 * pixels into a single rectangle. A 24x24 sprite is a few hundred pixels; one <Rect> each would
 * mean hundreds of native views per render, whereas merged paths are a dozen — and fewer
 * internal edges means fewer places for anti-aliasing to show a seam.
 */
export const buildSpritePaths = (
    rows: ReadonlyArray<string>,
    palette: { [key: string]: string },
): Array<{ color: string; d: string }> => {
    const byColor: { [color: string]: string[] } = {};
    rows.forEach((row, y) => {
        let x = 0;
        while (x < row.length) {
            const color = palette[row[x]];
            let runLength = 1;
            while (x + runLength < row.length && palette[row[x + runLength]] === color) {
                runLength += 1;
            }
            if (color) {
                (byColor[color] = byColor[color] || []).push(`M${x} ${y}h${runLength}v1h-${runLength}z`);
            }
            x += runLength;
        }
    });
    return Object.entries(byColor).map(([color, segments]) => ({ color, d: segments.join('') }));
};
