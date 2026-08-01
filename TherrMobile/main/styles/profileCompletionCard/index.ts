import Color from 'color';
import { StyleSheet } from 'react-native';
import { IMobileThemeName } from 'therr-react/types';
import { getTheme, ITherrTheme } from '../themes';
import { shadowSm } from '../elevation';
import { radius } from '../radii';
import { space } from '../layouts/spacing';
import { fontSizes, fontWeights } from '../text';
import { therrFontFamily } from '../font';

// Soft brand wash so the card reads as an invitation rather than an alert
// (same treatment as styles/incompleteProfileBanner).
const tint = (hex: string, opacity: number) => new Color(hex).alpha(opacity).toString();

const buildStyles = (themeName?: IMobileThemeName) => {
    const therrTheme: ITherrTheme = getTheme(themeName);

    const isDark = themeName !== 'light';
    const washOpacity = isDark ? 0.18 : 0.1;

    const styles = StyleSheet.create({
        container: {
            ...shadowSm,
            // ViewUser's parent container centers its children (`alignItems: 'center'`),
            // which makes an unconstrained child shrink to fit its content instead of
            // filling the row. Stretch explicitly — siblings there do the same with
            // `width: '100%'`, but that would overflow by 2x the horizontal margin here.
            alignSelf: 'stretch',
            backgroundColor: tint(therrTheme.colors.brand, washOpacity),
            borderRadius: radius.xl,
            marginHorizontal: space.lg,
            marginTop: space.md,
            marginBottom: space.sm,
            paddingHorizontal: space.lg,
            paddingTop: space.md,
            paddingBottom: space.lg,
        },
        headerRow: {
            display: 'flex',
            flexDirection: 'row',
            alignItems: 'center',
        },
        headerTextContainer: {
            flex: 1,
        },
        title: {
            fontFamily: therrFontFamily,
            fontSize: fontSizes.lg,
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
        collapseButton: {
            padding: space.sm,
            marginLeft: space.sm,
        },
        collapseIcon: {
            color: therrTheme.colors.brandDark,
        },
        progressTrack: {
            height: 12,
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
            marginTop: space.md,
        },
        stepRow: {
            display: 'flex',
            flexDirection: 'row',
            alignItems: 'center',
            paddingVertical: space.sm,
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
            marginTop: space.md,
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
    });

    return ({
        ...therrTheme,
        styles,
    });
};

export {
    buildStyles,
};
