import { StyleSheet } from 'react-native';
import { IMobileThemeName } from 'therr-react/types';
import { getTheme } from '../../themes';
import { space } from '../../layouts/spacing';

export const CATEGORY_CHIP_HEIGHT = 34;

const buildStyles = (themeName?: IMobileThemeName) => {
    const therrTheme = getTheme(themeName);
    const { colors } = therrTheme;
    // In retro the screen surface is itself teal, so a `brand` fill would vanish into it.
    // Its `brandDark` is the complementary dark blue, which still reads as "selected".
    const selectedFill = themeName === 'retro' ? colors.brandDark : colors.brand;

    const chipBase: any = {
        flexDirection: 'row',
        alignItems: 'center',
        height: CATEGORY_CHIP_HEIGHT,
        paddingLeft: 10,
        paddingRight: 14,
        borderRadius: CATEGORY_CHIP_HEIGHT / 2,
        borderWidth: StyleSheet.hairlineWidth,
    };

    const styles = StyleSheet.create({
        container: {
            paddingVertical: space.sm,
        },
        headerRow: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            minHeight: 28,
            marginBottom: space.xs,
        },
        header: {
            fontSize: 13,
            fontWeight: '600',
            letterSpacing: 0.2,
            color: colors.onSurfaceMuted,
        },
        clearButton: {
            paddingVertical: space.xs,
            paddingHorizontal: space.xs,
        },
        clearButtonTitle: {
            fontSize: 14,
            fontWeight: '600',
            color: selectedFill,
        },
        scrollList: {
            gap: space.sm,
        },
        wrapList: {
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: space.sm,
        },
        chip: {
            ...chipBase,
            backgroundColor: colors.surfaceAlt,
            // A hairline keeps the chip defined where the screen itself is surfaceAlt-colored
            // (EditGroup's accent1 background in the dark theme).
            borderColor: colors.border,
        },
        chipActive: {
            ...chipBase,
            backgroundColor: selectedFill,
            borderColor: selectedFill,
        },
        chipPressed: {
            opacity: 0.7,
        },
        chipIcon: {
            marginRight: 6,
        },
        chipLabel: {
            fontSize: 14,
            fontWeight: '500',
            color: colors.onSurface,
        },
        chipLabelActive: {
            fontSize: 14,
            fontWeight: '600',
            color: colors.onBrand,
        },
    });

    return ({
        ...therrTheme,
        selectedFill,
        styles,
    });
};

export {
    buildStyles,
};
