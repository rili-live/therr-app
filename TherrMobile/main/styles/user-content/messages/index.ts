import { StyleSheet } from 'react-native';
import { IMobileThemeName } from 'therr-react/types';
import { bottomSafeAreaInset } from '../../navigation/buttonMenu';
import { getTheme, ITherrTheme } from '../../themes';

const containerStyles: any = {
    display: 'flex',
    padding: 5,
    paddingHorizontal: 12,
    borderRadius: 14,
    marginBottom: 7,
    marginLeft: '2%',
    marginRight: '2%',
};

const getMessageStyles = (theme: ITherrTheme, themeName: string) => ({
    color: themeName === 'light' ? theme.colors.accentTextBlack : theme.colors.textWhite,
    fontSize: 16,
});

const getMessageDateStyles = (theme: ITherrTheme, themeName: string) => ({
    ...getMessageStyles(theme, themeName),
    fontSize: 11,
    color: theme.colors.textBlack,
});

const buildStyles = (themeName?: IMobileThemeName) => {
    const therrTheme = getTheme(themeName);
    const styles = StyleSheet.create({
        container: {
            display: 'flex',
            flexDirection: 'column',
            margin: 10,
            marginBottom: 0,
            flex: 1,
        },
        messageContainerLeft: {
            ...containerStyles,
            marginRight: '10%',
            backgroundColor: therrTheme.colors.backgroundGray,
            alignSelf: 'flex-start',
        },
        messageContainerRight: {
            ...containerStyles,
            marginLeft: '10%',
            backgroundColor: therrTheme.colors.accent2,
            alignSelf: 'flex-end',
        },
        messageTextLeft: {
            ...getMessageStyles(therrTheme, themeName),
            color: themeName === 'light' ? therrTheme.colors.textWhite : therrTheme.colors.textWhite,
        },
        messageTextRight: {
            ...getMessageStyles(therrTheme, themeName),
            color: themeName === 'light' ? therrTheme.colors.textBlack : therrTheme.colors.brandingBlack,
        },
        messageDateLeft: {
            ...getMessageDateStyles(therrTheme, themeName),
            color: themeName === 'light' ? therrTheme.colors.textWhite : therrTheme.colors.textBlack,
        },
        messageDateRight: {
            ...getMessageDateStyles(therrTheme, themeName),
        },
        sectionContainer: {
            display: 'flex',
            flexDirection: 'row',
            marginTop: 16,
            marginBottom: 16,
            paddingHorizontal: 12,
        },
        sendInputsContainer: {
            display: 'flex',
            flexDirection: 'row',
            width: '100%',
            alignItems: 'center',
            justifyContent: 'center',
            paddingTop: 12,
            paddingBottom: 12 + bottomSafeAreaInset,
            height: 80 + bottomSafeAreaInset,
        },
        userImage: {
            // color: therrTheme.colors.primary3,
            marginRight: 10,
            height: 50,
            width: 50,
            borderRadius: 25,
        },
        icon: {
            color: therrTheme.colors.brandingWhite,
            padding: 0,
            margin: 0,
        },
        inputContainer: {
            display: 'flex',
            flex: 1,
        },
        sendBtn: {
            borderRadius: 22,
            backgroundColor: therrTheme.colors.primary3,
            width: 44,
            height: 44,
        },
        sendBtnContainer: {
            margin: 0,
            marginLeft: 8,
            borderRadius: 22,
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
