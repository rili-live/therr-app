import Color from 'color';
import { StyleSheet } from 'react-native';
import { IMobileThemeName } from 'therr-react/types';
import { getTheme, ITherrTheme } from '../themes';
import { radius } from '../radii';
import { space } from '../layouts/spacing';
import { fontSizes, fontWeights } from '../text';
import { therrFontFamily } from '../font';

// Soft brand wash so the row reads as an invitation rather than an alert
// (same treatment as styles/incompleteProfileBanner).
const tint = (hex: string, opacity: number) => new Color(hex).alpha(opacity).toString();

const buildStyles = (themeName?: IMobileThemeName) => {
    const therrTheme: ITherrTheme = getTheme(themeName);

    const isDark = themeName !== 'light';
    const washOpacity = isDark ? 0.16 : 0.08;

    const styles = StyleSheet.create({
        // Deliberately flat: this sits inline in the profile column, so it is
        // separated by a hairline border and a tint rather than an elevation
        // shadow. The shadow tokens cast a heavy grey halo at this width and
        // made the section read as a floating modal over the profile.
        container: {
            display: 'flex',
            flexDirection: 'row',
            alignItems: 'center',
            // ViewUser's parent container centers its children (`alignItems: 'center'`),
            // which makes an unconstrained child shrink to fit its content instead of
            // filling the row.
            alignSelf: 'stretch',
            backgroundColor: tint(therrTheme.colors.brand, washOpacity),
            borderWidth: 1,
            borderColor: tint(therrTheme.colors.brand, isDark ? 0.4 : 0.22),
            borderRadius: radius.lg,
            marginHorizontal: space.lg,
            marginTop: space.md,
            marginBottom: space.sm,
            paddingVertical: space.md,
            paddingHorizontal: space.md,
        },
        iconContainer: {
            width: 34,
            height: 34,
            borderRadius: radius.circle,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: therrTheme.colors.brand,
            marginRight: space.md,
        },
        icon: {
            color: therrTheme.colors.onBrand,
        },
        textContainer: {
            flex: 1,
        },
        title: {
            fontFamily: therrFontFamily,
            fontSize: fontSizes.md,
            fontWeight: fontWeights.bold,
            color: therrTheme.colors.brandDark,
        },
        stepsLeft: {
            fontSize: fontSizes.xs,
            color: therrTheme.colors.onSurfaceMuted,
            marginTop: 2,
        },
        progressTrack: {
            height: 4,
            borderRadius: radius.pill,
            backgroundColor: tint(therrTheme.colors.onSurfaceMuted, isDark ? 0.3 : 0.18),
            overflow: 'hidden',
            marginTop: space.sm,
        },
        progressFill: {
            height: '100%',
            borderRadius: radius.pill,
            backgroundColor: therrTheme.colors.brand,
        },
        chevron: {
            color: therrTheme.colors.brandDark,
            marginLeft: space.md,
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
