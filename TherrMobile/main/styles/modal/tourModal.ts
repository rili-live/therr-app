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
            justifyContent: 'flex-start',
            alignItems: 'center',
            width: '90%',
            padding: 10,
            backgroundColor: therrTheme.colors.backgroundGray,
            elevation: 5,
            borderRadius: 12,
        },
        graphic: {
            height: 150,
            width: 150,
            display: 'flex',
            paddingVertical: 10,
            marginBottom: 40,
        },
        header: {
            fontSize: 20,
            fontWeight: '800',
            paddingBottom: 8,
            fontFamily: therrFontFamily,
        },
        text: {
            paddingBottom: 5,
            paddingHorizontal: 8,
            fontSize: 16,
            fontFamily: therrFontFamily,
        },
        buttonContainer: {
            height: 150,
            width: 200,
            display: 'flex',
            paddingVertical: 10,
            marginBottom: 20,
            justifyContent: 'center',
        },
        buttonPrimary: {
            backgroundColor: therrTheme.colors.primary3,
            display: 'flex',
            alignItems: 'center',
            borderRadius: 20,
            height: 49,
        },
        buttonTitle: {
            fontSize: 18,
            fontWeight: '500',
            fontFamily: therrFontFamily,
            color: therrTheme.colors.textBlack,
        },
        buttonIconStyle: {
            color: therrTheme.colors.textBlack,
            paddingLeft: 8,
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
