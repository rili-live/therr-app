import { StyleSheet } from 'react-native';
import { IMobileThemeName } from 'therr-react/types';
import { therrFontFamily } from '../font';
import { getTheme } from '../themes';

const buildStyles = (themeName?: IMobileThemeName) => {
    const therrTheme = getTheme(themeName);

    const styles = StyleSheet.create({
        overlay: {
            flex: 1,
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: therrTheme.colors.textGray,
        },
        container: {
            display: 'flex',
            justifyContent: 'flex-start',
            alignItems: 'center',
            maxHeight: '60%',
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
            fontFamily: therrFontFamily,
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
            fontFamily: therrFontFamily,
            padding: 10,
            textAlign: 'center',
        },
        bodyTextBold: {
            fontSize: 20,
            fontWeight: '600',
            fontFamily: therrFontFamily,
            padding: 10,
            paddingTop: 15,
            paddingBottom: 20,
            textAlign: 'center',
        },
        graphic: {
            height: 150,
            width: 150,
            display: 'flex',
            paddingVertical: 10,
            marginBottom: 40,
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
