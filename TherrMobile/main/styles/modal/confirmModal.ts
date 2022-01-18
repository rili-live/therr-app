import { StyleSheet } from 'react-native';
import { IMobileThemeName } from 'therr-react/types';
import { getTheme } from '../themes';

const buildStyles = (themeName?: IMobileThemeName) => {
    const therrTheme = getTheme(themeName);

    const styles = StyleSheet.create({
        overlay: {
            flex: 1,
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
        },
        container: {
            display: 'flex',
            justifyContent: 'flex-start',
            alignItems: 'center',
            maxHeight: '50%',
            width: '75%',
            backgroundColor: therrTheme.colors.backgroundGray,
            elevation: 5,
            borderRadius: 12,
        },
        header: {
            width: '100%',
            paddingVertical: 8,
            paddingHorizontal: 5,
            borderBottomColor: therrTheme.colorVariations.textBlackFade,
            borderBottomWidth: 1,
        },
        headerText: {
            fontSize: 20,
            fontWeight: '800',
            textAlign: 'center',
        },
        body: {
            height: '100%',
            paddingBottom: 10,
        },
        bodyContent: {
            display: 'flex',
            minHeight: '100%',
        },
        buttonsContainer: {
            display: 'flex',
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            borderTopColor: therrTheme.colorVariations.textBlackFade,
            borderTopWidth: 1,
        },
        buttonContainer: {
            flex: 1,
            borderRightColor: therrTheme.colorVariations.textBlackFade,
            borderTopRightRadius: 0,
            borderBottomRightRadius: 0,
        },
        bodyText: {
            fontSize: 16,
            fontWeight: '400',
            padding: 10,
            textAlign: 'center',
        },
        bodyTextBold: {
            fontSize: 20,
            fontWeight: '600',
            padding: 10,
            paddingTop: 15,
            paddingBottom: 20,
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
