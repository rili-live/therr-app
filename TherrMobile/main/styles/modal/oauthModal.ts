import { StyleSheet } from 'react-native';
import { IMobileThemeName } from 'therr-react/types';
import { therrFontFamily } from '../font';
import { getTheme } from '../themes';

const buildStyles = (themeName?: IMobileThemeName) => {
    const therrTheme = getTheme(themeName);

    const styles = StyleSheet.create({
        actionsContainer: {
            display: 'flex',
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
        },
        overlay: {
            flex: 1,
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: therrTheme.colors.textGray,
        },
        container: {
            display: 'flex',
            flexDirection: 'row',
            justifyContent: 'flex-start',
            alignItems: 'center',
            width: '90%',
            maxHeight: '85%',
            minHeight: '65%',
            padding: 0,
            backgroundColor: therrTheme.colors.backgroundGray,
            elevation: 5,
            borderRadius: 0,
        },
        wrapper: {
            display: 'flex',
            height: '100%',
            flexDirection: 'column',
            flex: 1,
            justifyContent: 'center',
            alignItems: 'center',
        },
        webView: {
            flex: 1,
            width: '100%',
        },
        text: {
            paddingBottom: 5,
            paddingHorizontal: 8,
            fontSize: 16,
            fontFamily: therrFontFamily,
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
