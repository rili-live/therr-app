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
    borderBottomWidth: 2,
    borderColor: '#4950571c',
};

export const notifications = StyleSheet.create({
    container: {
        marginBottom: 145,
    },
});

export const notification = StyleSheet.create({
    rootUnread: {
        ...rootStyle,
        backgroundColor: therrTheme.colors.backgroundWhite,
    },
    rootRead: {
        ...rootStyle,
        backgroundColor: '#f2f2f2',
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
        paddingRight: messageContainerStyle.paddiing,
    },
    unread: {
        ...notificationStyle,
        color: 'black',
    },
    read: {
        ...notificationStyle,
        color: '#868686',
    },
    iconUnread: {
        ...iconStyle,
        color: therrTheme.colors.primary,
    },
    iconRead: {
        ...iconStyle,
        color: 'black',
    },
});
