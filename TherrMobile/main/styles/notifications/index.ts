import { StyleSheet } from 'react-native';
import { IMobileThemeName } from 'therr-react/types';
import { getTheme } from '../themes';

const messageContainerStyle: any = {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
};

const notificationStyle: any = {
    textAlign: 'left',
    fontSize: 16,
};

const notifications = StyleSheet.create({
    container: {
        marginTop: 20,
    },
    firstChildNotification: {
        borderTopWidth: 1,
    },
});

const getRootStyle: any = (theme) => ({
    display: 'flex',
    marginLeft: 14,
    marginRight: 14,
    padding: 10,
    paddingBottom: 12,
    paddingTop: 12,
    borderRadius: 0,
    borderBottomWidth: 1,
    borderColor: theme.colors.accentAlt,
});

const buildStyles = (themeName?: IMobileThemeName) => {
    const therrTheme = getTheme(themeName);
    const styles = StyleSheet.create({
        rootUnread: {
            ...getRootStyle(therrTheme),
            backgroundColor: therrTheme.colors.backgroundGray,
        },
        rootRead: {
            ...getRootStyle(therrTheme),
            backgroundColor: 'transparent',
        },
        actionsContainer: {
            display: 'flex',
            flexDirection: 'row',
            justifyContent: 'flex-end',
        },
        actionButton: {
            marginLeft: 5,
        },
        actionButtonText: {
            color: 'black',
            paddingLeft: 5,
        },
        messageContainerUnread: {
            ...messageContainerStyle,
            paddingRight: 35,
        },
        messageContainerRead: {
            ...messageContainerStyle,
            paddingRight: 35,
        },
        unread: {
            ...notificationStyle,
            color: therrTheme.colors.brandingBlueGreen,
        },
        read: {
            ...notificationStyle,
            color: therrTheme.colors.textWhite,
        },
        iconContainerStyle: {
            position: 'absolute',
            right: 10,
        },
        iconUnread: {
            color: therrTheme.colors.brandingBlueGreen,
        },
        iconRead: {
            color: therrTheme.colors.accent1Fade,
        },
    });

    return ({
        ...therrTheme,
        styles,
    });
};

export {
    buildStyles,
    notifications,
};
