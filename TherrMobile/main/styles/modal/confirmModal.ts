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
            alignSelf: 'center',
            maxHeight: '60%',
            width: '75%',
            backgroundColor: therrTheme.colors.backgroundGray,
            elevation: 5,
            borderRadius: 12,
            paddingBottom: 0,
        },
        header: {
            width: '100%',
            paddingVertical: 8,
            paddingHorizontal: 5,
            borderBottomWidth: 0,
        },
        headerText: {
            fontSize: 20,
            fontWeight: '800',
            textAlign: 'center',
            fontFamily: therrFontFamily,
            color: therrTheme.colors.textWhite,
        },
        body: {
            flexShrink: 1,
            paddingBottom: 10,
        },
        bodyContent: {
            display: 'flex',
        },
        buttonsContainer: {
            display: 'flex',
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-evenly',
            borderTopWidth: 0,
            width: '100%',
            paddingHorizontal: 0,
            paddingVertical: 4,
            paddingBottom: 4,
            marginBottom: 0,
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
            color: therrTheme.colors.textWhite,
        },
        bodyTextBold: {
            fontSize: 20,
            fontWeight: '600',
            fontFamily: therrFontFamily,
            padding: 10,
            paddingTop: 15,
            paddingBottom: 20,
            textAlign: 'center',
            color: therrTheme.colors.textWhite,
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
