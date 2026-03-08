import { Dimensions, StyleSheet } from 'react-native';
import { IMobileThemeName } from 'therr-react/types';
import { therrFontFamily } from '../font';
import { getTheme } from '../themes';

const { width: screenWidth } = Dimensions.get('window');

export const MINIMUM_HORIZONTAL_PADDING = 20;

const buildStyles = (themeName?: IMobileThemeName) => {
    const therrTheme = getTheme(themeName);
    const styles = StyleSheet.create({
        tooltipContainer: {
            backgroundColor: therrTheme.colors.backgroundWhite,
            borderRadius: 12,
            padding: 16,
            maxWidth: screenWidth - MINIMUM_HORIZONTAL_PADDING,
            elevation: 5,
        },
        header: {
            fontSize: 18,
            fontFamily: therrFontFamily,
            fontWeight: '600',
            color: therrTheme.colors.brandingBlack,
            textAlign: 'center',
            marginBottom: 4,
        },
        body: {},
        text: {
            fontSize: 16,
            fontWeight: '400',
            fontFamily: therrFontFamily,
            paddingHorizontal: 4,
            paddingVertical: 6,
            textAlign: 'center',
        },
        actionsContainer: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginTop: 12,
            gap: 12,
        },
        actionButton: {
            flex: 1,
            borderRadius: 20,
        },
        actionButtonContentRight: {
            flexDirection: 'row-reverse',
        },
        skipButton: {
            alignSelf: 'center',
            marginTop: 4,
        },
        skipButtonLabel: {
            fontSize: 13,
            color: therrTheme.colors.textGray,
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
