import { StyleSheet } from 'react-native';
import { HEADER_HEIGHT, HEADER_EXTRA_HEIGHT } from '..';
import * as therrTheme from '../themes';

const containerBackgroundColor = therrTheme.colors.textWhite;
// const brandingYellow = '#ebc300';

const userProfileButtonContainerStyles: any = {
    margin: 0,
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'flex-end',
    alignItems: 'center',
};

export default StyleSheet.create({
    container: {
        display: 'flex',
        flexDirection: 'column',
        flex: 1,
        position: 'relative',
    },
    buttons: {
        backgroundColor: 'transparent',
        height: HEADER_HEIGHT - HEADER_EXTRA_HEIGHT,
        display: 'flex',
        justifyContent: 'space-between',
    },
    buttonsActive: {
        backgroundColor: 'transparent',
        height: HEADER_HEIGHT - HEADER_EXTRA_HEIGHT,
        display: 'flex',
        justifyContent: 'space-between',
    },
    buttonsTitle: {
        backgroundColor: 'transparent',
        color: therrTheme.colors.accentAlt,
        paddingRight: 10,
        paddingLeft: 10,
    },
    buttonsTitleActive: {
        backgroundColor: 'transparent',
        color: therrTheme.colors.primary,
        paddingRight: 10,
        paddingLeft: 10,
    },
    iconStyle: {
        color: therrTheme.colors.accentAlt,
        // position: 'absolute',
        // left: 20
        paddingRight: 10,
    },
    iconStyleActive: {
        color: therrTheme.colors.primary,
        // position: 'absolute',
        // left: 20
        paddingRight: 10,
    },
    notificationsItemContainer: {
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
    },
    notificationCircle: {
        position: 'absolute',
        top: 7,
        right: 14,
        borderWidth: 4,
        borderRadius: 3,
        width: 4,
        height: 4,
        borderColor: therrTheme.colors.brandingOrange,
    },
    overlayContainer: {
        backgroundColor: containerBackgroundColor,
        display: 'flex',
        height: '100%',
        width: '75%',
        alignSelf: 'flex-end',
        flexDirection: 'column',
        borderRadius: 0,
        padding: 0,
    },
    header: {
        marginTop: HEADER_EXTRA_HEIGHT,
        marginBottom: 10,
        paddingBottom: 4,
        display: 'flex',
        flexDirection: 'row',
        color: therrTheme.colors.accent3,
        borderBottomWidth: 2,
        borderBottomColor: therrTheme.colors.accentDivider,
        height: HEADER_HEIGHT - HEADER_EXTRA_HEIGHT,
    },
    headerTitle: {
        display: 'flex',
        flexDirection: 'row',
        flex: 1,
        alignItems: 'center',
        marginLeft: 20,
    },
    headerTitleText: {
        color: therrTheme.colors.primary3,
        fontSize: 20,
        letterSpacing: 3,
    },
    headerTitleIcon: {
        // color: therrTheme.colors.accentAlt,
        marginRight: 10,
        height: 30,
        width: 30,
        borderRadius: 15,
    },
    body: {
        flex: 1,
        overflow: 'hidden',
    },
    footer: {
        paddingBottom: 8,
    },
    toggleIcon: {
        height: 30,
        width: 30,
        borderRadius: 15,
    },
    logoutIcon: {
        height: 22,
        width: 22,
        borderRadius: 15,
        color: therrTheme.colors.textWhite,
    },
    toggleIconDark: {
        height: 30,
        width: 30,
        borderRadius: 15,
    },
    userProfileButtonContainer: {
        ...userProfileButtonContainerStyles,
    },
    userProfileButtonContainerVerified: {
        ...userProfileButtonContainerStyles,
    },
});
