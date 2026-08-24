import Color from 'color';
import { StyleSheet } from 'react-native';
import { IMobileThemeName } from 'therr-react/types';
import { getTheme, ITherrTheme } from '../themes';
import { radius } from '../radii';
import { space } from '../layouts/spacing';
import { fontSizes, fontWeights } from '../text';
import { therrFontFamily } from '../font';

// Soft brand wash so the screen reads as an invitation rather than an alert
// (same treatment as styles/profileCompletionLink).
const tint = (hex: string, opacity: number) => new Color(hex).alpha(opacity).toString();

const buildStyles = (themeName?: IMobileThemeName) => {
    const therrTheme: ITherrTheme = getTheme(themeName);

    const isDark = themeName !== 'light';

    const styles = StyleSheet.create({
        scrollContent: {
            paddingHorizontal: space.lg,
            paddingTop: space.lg,
            paddingBottom: space.xxl,
        },
        title: {
            fontFamily: therrFontFamily,
            fontSize: fontSizes.xl,
            fontWeight: fontWeights.bold,
            color: therrTheme.colors.brandDark,
        },
        stepsLeft: {
            fontSize: fontSizes.xs,
            fontWeight: fontWeights.semibold,
            letterSpacing: 1,
            textTransform: 'uppercase',
            color: therrTheme.colors.onSurfaceMuted,
            marginTop: space.xs,
        },
        progressTrack: {
            height: 10,
            borderRadius: radius.pill,
            backgroundColor: tint(therrTheme.colors.onSurfaceMuted, isDark ? 0.3 : 0.18),
            overflow: 'hidden',
            marginTop: space.md,
        },
        progressFill: {
            height: '100%',
            borderRadius: radius.pill,
            backgroundColor: therrTheme.colors.brand,
        },
        stepList: {
            marginTop: space.lg,
        },
        // Rows carry their own surface here — there is no card wrapper on the
        // screen, and a hairline border separates them rather than an elevation
        // shadow (the shadow tokens cast a heavy grey halo at this width).
        stepRow: {
            display: 'flex',
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: tint(therrTheme.colors.brand, isDark ? 0.12 : 0.06),
            borderWidth: 1,
            borderColor: tint(therrTheme.colors.brand, isDark ? 0.32 : 0.16),
            borderRadius: radius.lg,
            paddingVertical: space.md,
            paddingHorizontal: space.md,
            marginBottom: space.sm,
        },
        stepIndicator: {
            width: 28,
            height: 28,
            borderRadius: radius.circle,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderWidth: 2,
            borderColor: therrTheme.colors.brand,
            marginRight: space.md,
        },
        stepIndicatorComplete: {
            backgroundColor: therrTheme.colors.brand,
            borderColor: therrTheme.colors.brand,
        },
        stepIndicatorSkipped: {
            borderColor: therrTheme.colors.onSurfaceMuted,
        },
        stepIndicatorIcon: {
            color: therrTheme.colors.brand,
        },
        stepIndicatorIconComplete: {
            color: therrTheme.colors.onBrand,
        },
        stepIndicatorIconSkipped: {
            color: therrTheme.colors.onSurfaceMuted,
        },
        stepTextContainer: {
            flex: 1,
        },
        stepLabel: {
            fontSize: fontSizes.sm,
            fontWeight: fontWeights.semibold,
            color: therrTheme.colors.onSurface,
        },
        stepLabelComplete: {
            color: therrTheme.colors.onSurfaceMuted,
            textDecorationLine: 'line-through',
        },
        stepDescription: {
            fontSize: fontSizes.xs,
            color: therrTheme.colors.onSurfaceMuted,
            marginTop: 2,
        },
        stepChevron: {
            color: therrTheme.colors.onSurfaceMuted,
            marginLeft: space.sm,
        },
        continueButtonContainer: {
            marginTop: space.lg,
        },
        continueButton: {
            backgroundColor: therrTheme.colors.brand,
            borderRadius: radius.lg,
            paddingVertical: space.md,
        },
        continueButtonTitle: {
            fontFamily: therrFontFamily,
            fontSize: fontSizes.md,
            fontWeight: fontWeights.bold,
            letterSpacing: 1,
            textTransform: 'uppercase',
            color: therrTheme.colors.onBrand,
        },
        completeContainer: {
            display: 'flex',
            alignItems: 'center',
            paddingVertical: space.xxl,
        },
        completeIcon: {
            color: therrTheme.colors.brand,
            marginBottom: space.lg,
        },
        completeText: {
            fontSize: fontSizes.md,
            color: therrTheme.colors.onSurface,
            textAlign: 'center',
        },
    });

    return ({
        ...therrTheme,
        styles,
    });
};

export {
    buildStyles,
};
