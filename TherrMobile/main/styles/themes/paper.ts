import Color from 'color';
import { MD3LightTheme, MD3DarkTheme, configureFonts } from 'react-native-paper';
import type { MD3Theme } from 'react-native-paper';
import { IMobileThemeName } from 'therr-react/types';
import { colors as lightColors } from './light/colors';
import { colors as darkColors } from './dark/colors';
import { colors as retroColors } from './retro/colors';
import { therrFontFamily } from '../font';
import { tiny, small, medium, large, xlarge } from '../layouts/spacing';

// ---------------------------------------------------------------------------
// Font Configuration
// ---------------------------------------------------------------------------
// Flat config merges fontFamily into every MD3 typescale variant
// (displayLarge, headlineMedium, bodyLarge, labelSmall, etc.)
const fonts = configureFonts({ config: { fontFamily: therrFontFamily } });

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Generate elevation surface tint levels for a given base surface color
 * and tint color (usually primary). Paper uses opaque RGB values for
 * elevation levels to avoid shadow transfer issues on Android.
 */
const buildElevationLevels = (surface: string, tint: string) => {
    const surfaceColor = new Color(surface);
    const tintColor = new Color(tint);
    return {
        level0: 'transparent',
        level1: surfaceColor.mix(tintColor, 0.05).rgb().string(),
        level2: surfaceColor.mix(tintColor, 0.08).rgb().string(),
        level3: surfaceColor.mix(tintColor, 0.11).rgb().string(),
        level4: surfaceColor.mix(tintColor, 0.12).rgb().string(),
        level5: surfaceColor.mix(tintColor, 0.14).rgb().string(),
    };
};

// ---------------------------------------------------------------------------
// Custom theme extensions
// ---------------------------------------------------------------------------
// These are app-specific tokens appended to the standard MD3Theme.
// Access via `theme.custom.spacing.medium`, `theme.custom.brandColors.orange`, etc.
export interface ITherrPaperCustom {
    spacing: {
        tiny: number;
        small: number;
        medium: number;
        large: number;
        xlarge: number;
    };
    brandColors: {
        white: string;
        black: string;
        blueGreen: string;
        mapYellow: string;
        orange: string;
        red: string;
        lightBlue: string;
    };
}

export interface ITherrPaperTheme extends MD3Theme {
    custom: ITherrPaperCustom;
}

const customTokens: ITherrPaperCustom = {
    spacing: { tiny, small, medium, large, xlarge },
    brandColors: {
        white: lightColors.brandingWhite,
        black: lightColors.brandingBlack,
        blueGreen: lightColors.brandingBlueGreen,
        mapYellow: lightColors.brandingMapYellow,
        orange: lightColors.brandingOrange,
        red: lightColors.brandingRed,
        lightBlue: lightColors.brandingLightBlue,
    },
};

// ---------------------------------------------------------------------------
// Light Theme
// ---------------------------------------------------------------------------
// Primary teal (#1C7F8A) on white background, orange secondary accent.
// Maps from the existing light/colors.ts values.
export const paperLightTheme: ITherrPaperTheme = {
    ...MD3LightTheme,
    fonts,
    roundness: 4,
    colors: {
        ...MD3LightTheme.colors,

        // Primary — teal
        primary: lightColors.primary3,                 // #1C7F8A
        onPrimary: lightColors.brandingWhite,          // #fcfeff
        primaryContainer: lightColors.brandingLightBlue, // #d8f0f2
        onPrimaryContainer: lightColors.primary4,      // #104B52

        // Secondary — orange
        secondary: lightColors.secondary,              // #E37107
        onSecondary: lightColors.brandingWhite,        // #fcfeff
        secondaryContainer: lightColors.ternary2,      // #ffc269
        onSecondaryContainer: '#5C2E00',

        // Tertiary — dark teal
        tertiary: lightColors.tertiary,                // #104B52
        onTertiary: lightColors.brandingWhite,         // #fcfeff
        tertiaryContainer: lightColors.brandingLightBlue, // #d8f0f2
        onTertiaryContainer: lightColors.primary4,     // #104B52

        // Surfaces
        surface: lightColors.backgroundWhite,          // #ffffff
        surfaceVariant: lightColors.backgroundGray,    // #f3f4f6
        surfaceDisabled: new Color(lightColors.textDark).alpha(0.12).rgb().string(),
        background: lightColors.backgroundWhite,       // #ffffff
        onSurface: lightColors.textDark,               // #363636
        onSurfaceVariant: lightColors.textDarkGray,    // #728f94
        onSurfaceDisabled: new Color(lightColors.textDark).alpha(0.38).rgb().string(),
        onBackground: lightColors.textDark,            // #363636

        // Error
        error: lightColors.alertError,                 // #AC3E59
        onError: lightColors.brandingWhite,            // #fcfeff
        errorContainer: '#FFDAD6',
        onErrorContainer: '#410002',

        // Outline / dividers
        outline: lightColors.borderLight,              // gray
        outlineVariant: lightColors.backgroundNeutral, // #E7E8E8

        // Inverse (for snackbars, tooltips)
        inverseSurface: lightColors.brandingBlack,     // #001226
        inverseOnSurface: lightColors.brandingWhite,   // #fcfeff
        inversePrimary: lightColors.accentTeal,        // #2BC5D6

        // Misc
        shadow: '#000000',
        scrim: '#000000',
        backdrop: new Color('#000000').alpha(0.4).rgb().string(),

        // Elevation tints — opaque surface colors tinted with primary
        elevation: buildElevationLevels(
            lightColors.backgroundWhite,
            lightColors.primary3,
        ),
    },
    custom: customTokens,
};

// ---------------------------------------------------------------------------
// Dark Theme
// ---------------------------------------------------------------------------
// Standard dark mode: dark grey backgrounds (#121212) with teal primary.
// Maps from the new dark/colors.ts values.
export const paperDarkTheme: ITherrPaperTheme = {
    ...MD3DarkTheme,
    fonts,
    roundness: 4,
    colors: {
        ...MD3DarkTheme.colors,

        // Primary — lighter teal for dark surfaces
        primary: darkColors.primary4,                  // #22A5B4
        onPrimary: darkColors.primary,                 // #121212
        primaryContainer: darkColors.tertiary,         // #104B52
        onPrimaryContainer: darkColors.brandingLightBlue, // #d8f0f2

        // Secondary — orange
        secondary: darkColors.secondary,               // #E37107
        onSecondary: darkColors.primary,               // #121212
        secondaryContainer: '#5C2E00',
        onSecondaryContainer: darkColors.ternary2,     // #ffc269

        // Tertiary — brighter teal
        tertiary: darkColors.accentTeal,               // #2BC5D6
        onTertiary: darkColors.primary,                // #121212
        tertiaryContainer: darkColors.tertiary,        // #104B52
        onTertiaryContainer: darkColors.brandingLightBlue, // #d8f0f2

        // Surfaces
        surface: darkColors.primary2,                  // #1E1E1E
        surfaceVariant: darkColors.backgroundGray,     // #2A2A2A
        surfaceDisabled: new Color(darkColors.textWhite).alpha(0.12).rgb().string(),
        background: darkColors.primary,                // #121212
        onSurface: darkColors.textWhite,               // #F5F5F5
        onSurfaceVariant: darkColors.textDarkGray,     // #728f94
        onSurfaceDisabled: new Color(darkColors.textWhite).alpha(0.38).rgb().string(),
        onBackground: darkColors.textWhite,            // #F5F5F5

        // Error
        error: darkColors.alertError,                  // #CF6679
        onError: '#690005',
        errorContainer: '#93000A',
        onErrorContainer: '#FFDAD6',

        // Outline / dividers
        outline: darkColors.borderLight,               // #404040
        outlineVariant: darkColors.backgroundNeutral,  // #333333

        // Inverse
        inverseSurface: darkColors.textWhite,          // #F5F5F5
        inverseOnSurface: darkColors.primary,          // #121212
        inversePrimary: darkColors.primary3,           // #1C7F8A

        // Misc
        shadow: '#000000',
        scrim: '#000000',
        backdrop: new Color('#000000').alpha(0.5).rgb().string(),

        // Elevation tints — dark surfaces tinted with primary
        elevation: buildElevationLevels(
            darkColors.primary2,
            darkColors.primary4,
        ),
    },
    custom: customTokens,
};

// ---------------------------------------------------------------------------
// Retro Theme (alternative dark)
// ---------------------------------------------------------------------------
// Teal-heavy palette with warm golden accents. Existing "retro" identity
// preserved, mapped to Paper's dark theme structure.
export const paperRetroTheme: ITherrPaperTheme = {
    ...MD3DarkTheme,
    fonts,
    roundness: 4,
    colors: {
        ...MD3DarkTheme.colors,

        // Primary — bright teal
        primary: retroColors.primary4,                 // #22A5B4
        onPrimary: retroColors.brandingBlack,          // #001226
        primaryContainer: retroColors.tertiary,        // #104B52
        onPrimaryContainer: retroColors.brandingLightBlue, // #d8f0f2

        // Secondary — warm teal
        secondary: retroColors.secondary,              // #1E8A96
        onSecondary: retroColors.brandingBlack,        // #001226
        secondaryContainer: retroColors.primary3,      // #143b54
        onSecondaryContainer: retroColors.brandingLightBlue, // #d8f0f2

        // Tertiary — golden yellow (retro accent)
        tertiary: retroColors.ternary,                 // #e0c845
        onTertiary: retroColors.brandingBlack,         // #001226
        tertiaryContainer: '#5C5000',
        onTertiaryContainer: retroColors.ternary2,     // #ffc269

        // Surfaces
        surface: retroColors.primary2,                 // #20919E
        surfaceVariant: retroColors.primary3,          // #143b54
        surfaceDisabled: new Color(retroColors.textWhite).alpha(0.12).rgb().string(),
        background: retroColors.primary,               // #1C7F8A
        onSurface: retroColors.textWhite,              // #fcfeff
        onSurfaceVariant: retroColors.textDarkGray,    // #728f94
        onSurfaceDisabled: new Color(retroColors.textWhite).alpha(0.38).rgb().string(),
        onBackground: retroColors.textWhite,           // #fcfeff

        // Error
        error: retroColors.alertError,                 // #AC3E59
        onError: retroColors.brandingWhite,            // #fcfeff
        errorContainer: '#93000A',
        onErrorContainer: '#FFDAD6',

        // Outline / dividers
        outline: retroColors.borderLight,              // gray
        outlineVariant: retroColors.primary3,          // #143b54

        // Inverse
        inverseSurface: retroColors.backgroundCream,   // #fefbf0
        inverseOnSurface: retroColors.primary,         // #1C7F8A
        inversePrimary: retroColors.tertiary,          // #104B52

        // Misc
        shadow: '#000000',
        scrim: '#000000',
        backdrop: new Color(retroColors.primary3).alpha(0.5).rgb().string(),

        // Elevation tints — teal surfaces tinted with brighter teal
        elevation: buildElevationLevels(
            retroColors.primary2,
            retroColors.primary4,
        ),
    },
    custom: customTokens,
};

// ---------------------------------------------------------------------------
// Theme Accessor
// ---------------------------------------------------------------------------
export const getPaperTheme = (name?: IMobileThemeName): ITherrPaperTheme => {
    switch (name) {
        case 'light':
            return paperLightTheme;
        case 'dark':
            return paperDarkTheme;
        case 'retro':
            return paperRetroTheme;
        default:
            return paperLightTheme;
    }
};
