import { StyleSheet } from 'react-native';
import * as therrTheme from '../themes';

const messageContainerStyle: any = {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
};

const iconStyle: any = {
    position: 'absolute',
    right: 10,
};

const notificationStyle: any = {
    textAlign: 'left',
    fontSize: 16,
};

const rootStyle: any = {
    display: 'flex',
    marginLeft: 14,
    marginRight: 14,
    padding: 10,
    paddingBottom: 12,
    paddingTop: 12,
    borderRadius: 0,
    borderBottomWidth: 1,
    borderColor: therrTheme.colors.beemoAlt,
};

export const notifications = StyleSheet.create({
    container: {
        marginTop: 10,
        marginBottom: 145,
    },
    firstChildNotification: {
        borderTopWidth: 1,
    },
});

export const notification = StyleSheet.create({
    rootUnread: {
        ...rootStyle,
        backgroundColor: therrTheme.colors.backgroundGray,
    },
    rootRead: {
        ...rootStyle,
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
        color: therrTheme.colors.primary,
    },
    read: {
        ...notificationStyle,
        color: therrTheme.colors.textWhite,
    },
    iconUnread: {
        ...iconStyle,
        color: therrTheme.colors.primary,
    },
    iconRead: {
        ...iconStyle,
        color: therrTheme.colors.beemo1Fade,
    },
});
