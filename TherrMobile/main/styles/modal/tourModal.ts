import { StyleSheet } from 'react-native';
import { IMobileThemeName } from 'therr-react/types';
import { therrFontFamily } from '../font';
import { getTheme } from '../themes';

const buildStyles = (themeName?: IMobileThemeName) => {
    const therrTheme = getTheme(themeName);

    const styles = StyleSheet.create({
        actionsContainer: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginTop: 12,
            paddingHorizontal: 8,
            gap: 12,
        },
        actionButton: {
            flex: 1,
            borderRadius: 20,
        },
        actionButtonContentRight: {
            flexDirection: 'row-reverse',
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
            padding: 16,
            backgroundColor: therrTheme.colors.backgroundGray,
            elevation: 5,
            borderRadius: 12,
        },
        graphic: {
            height: 150,
            width: 150,
            display: 'flex',
            paddingVertical: 10,
            marginBottom: 20,
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
            textAlign: 'center',
        },
        buttonContainer: {
            width: '100%',
            display: 'flex',
            paddingVertical: 10,
            paddingHorizontal: 40,
            marginBottom: 10,
            justifyContent: 'center',
        },
        buttonPrimary: {
            borderRadius: 20,
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
