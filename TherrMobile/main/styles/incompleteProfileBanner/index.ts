import Color from 'color';
import { StyleSheet } from 'react-native';
import { IMobileThemeName } from 'therr-react/types';
import { getTheme, ITherrTheme } from '../themes';

// Tint the brand color into a soft wash so the banner reads as a gentle nudge
// rather than a saturated alert block (mirrors styles/alerts/index.ts).
const tint = (hex: string, opacity: number) => new Color(hex).alpha(opacity).toString();

const buildStyles = (themeName?: IMobileThemeName) => {
    const therrTheme: ITherrTheme = getTheme(themeName);

    const isDark = themeName !== 'light';
    const containerBgOpacity = isDark ? 0.2 : 0.12;

    const styles = StyleSheet.create({
        container: {
            display: 'flex',
            flexDirection: 'row',
            alignItems: 'center',
            paddingVertical: 10,
            paddingHorizontal: 14,
            backgroundColor: tint(therrTheme.colors.primary3, containerBgOpacity),
        },
        leadingIcon: {
            color: therrTheme.colors.primary3,
            marginRight: 12,
        },
        message: {
            flex: 1,
            fontSize: 14,
            color: therrTheme.colors.primary3,
        },
        dismissButton: {
            marginLeft: 12,
            padding: 4,
        },
        dismissIcon: {
            color: therrTheme.colors.primary3,
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
