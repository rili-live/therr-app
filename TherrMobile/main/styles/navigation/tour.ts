import { Dimensions, StyleSheet } from 'react-native';
import { IMobileThemeName } from 'therr-react/types';
import { therrFontFamily } from '../font';
import { getTheme } from '../themes';

const { width: screenWidth } = Dimensions.get('window');

export const MINIMUM_HORIZONTAL_PADDING = 20;

const buttonStyle: any = {
    backgroundColor: 'transparent',
    display: 'flex',
    flexDirection: 'column',
    flex: 1,
    width: '100%',
    borderRadius: 0,
};

const buildStyles = (themeName?: IMobileThemeName) => {
    const therrTheme = getTheme(themeName);
    const styles = StyleSheet.create({
        buttons: buttonStyle,
        tooltipContainer: {
            backgroundColor: therrTheme.colors.brandingWhite,
            borderRadius: 7,
            padding: 5,
            maxWidth: screenWidth - MINIMUM_HORIZONTAL_PADDING,
        },
        header: {
            fontSize: 18,
            fontFamily: therrFontFamily,
            fontWeight: '600',
            color: therrTheme.colors.brandingBlack,
            textAlign: 'center',
        },
        body: {},
        text: {
            fontSize: 16,
            fontWeight: '400',
            fontFamily: therrFontFamily,
            padding: 10,
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
