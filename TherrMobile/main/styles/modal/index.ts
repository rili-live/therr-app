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
            flexDirection: 'column',
            justifyContent: 'flex-start',
            alignItems: 'center',
            maxHeight: '50%',
            width: '80%',
            backgroundColor: therrTheme.colors.backgroundGray,
            elevation: 5,
            borderRadius: 12,
        },
        bottomSheetContainer: {
            display: 'flex',
            justifyContent: 'flex-start',
            alignItems: 'center',
            width: '100%',
            padding: 10,
            paddingBottom: 40,
            backgroundColor: therrTheme.colors.backgroundGray,
            borderTopWidth: 2,
            borderTopColor: therrTheme.colors.primary,
            // borderTopRightRadius: 15,
            // borderTopLeftRadius: 15,
            elevation: 5,
        },
        header: {
            width: '100%',
            paddingVertical: 14,
            paddingHorizontal: 10,
        },
        headerText: {
            fontSize: 22,
            fontWeight: '600',
            textAlign: 'center',
            fontFamily: therrFontFamily,
        },
        buttonsWrapper: {
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            flexDirection: 'row',
            flexWrap: 'wrap',
            paddingHorizontal: 20,
            marginBottom: 10,
        },
        label: {
            fontSize: 16,
            fontWeight: '500',
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
