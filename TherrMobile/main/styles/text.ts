import { StyleSheet } from 'react-native';

// Mobile-tuned type scale. Mobile is the primary product; pick what reads best
// on small screens at typical viewing distance. Use these tokens in new code
// instead of magic-number font sizes.
//
// xs/sm — captions, footnotes, dense list metadata
// md    — default body
// lg    — emphasized body, large list rows
// xl    — section subheadings
// xxl   — section headings, modal titles
// display — hero / onboarding titles
export const fontSizes = {
    xs: 12,
    sm: 14,
    md: 16,
    lg: 18,
    xl: 20,
    xxl: 24,
    display: 32,
} as const;

// Line-height multipliers. Multiply by fontSize to get the absolute lineHeight.
// tight — headings (display, xxl) where the type is the visual focus
// normal — body and most UI copy
// loose — long-form reading (thoughts, descriptions, modal body)
export const lineHeights = {
    tight: 1.2,
    normal: 1.4,
    loose: 1.6,
} as const;

// Font weights. Today only Lexend-Regular is bundled — Medium/Bold tokens are
// deferred until the font files are added to react-native.config.js + the iOS
// Info.plist UIAppFonts. Until then, fontWeight numbers map onto the closest
// system fallback, not Lexend.
export const fontWeights = {
    regular: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
} as const;

const styles = StyleSheet.create({
    capitalize: {
        textTransform: 'capitalize',
    },
    textRight: {
        textAlign: 'right',
    },
});

export default styles;
