import { StyleSheet } from 'react-native';
import { IMobileThemeName } from 'therr-react/types';
import { HEADER_HEIGHT, HEADER_EXTRA_HEIGHT } from '..';
import { therrFontFamily } from '../font';
import { getTheme } from '../themes';

const userProfileButtonContainerStyles: any = {
    margin: 0,
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'flex-end',
    alignItems: 'center',
};

const getNotificationCircleStyles = (theme): any => ({
    position: 'absolute',
    top: 7,
    right: 14,
    borderWidth: 4,
    borderRadius: 3,
    width: 4,
    height: 4,
    borderColor: theme.colors.brandingOrange,
});

const buildStyles = (themeName?: IMobileThemeName) => {
    const therrTheme = getTheme(themeName);

    const styles = StyleSheet.create({
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
            fontSize: 16,
            fontFamily: therrFontFamily,
        },
        buttonsTitleActive: {
            backgroundColor: 'transparent',
            color: therrTheme.colors.brandingBlueGreen,
            paddingRight: 10,
            paddingLeft: 10,
            fontSize: 18,
            fontFamily: therrFontFamily,
        },
        iconStyle: {
            color: therrTheme.colors.accentAlt,
            // position: 'absolute',
            // left: 20
            paddingRight: 10,
        },
        iconStyleActive: {
            color: therrTheme.colors.brandingBlueGreen,
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
            ...getNotificationCircleStyles(therrTheme),
        },
        notificationCircle2: {
            ...getNotificationCircleStyles(therrTheme),
            top: 7,
            right: 8,
            width: 5,
            height: 5,
        },
        notificationCircle3: {
            ...getNotificationCircleStyles(therrTheme),
            top: 2,
            right: 9,
            width: 5,
            height: 5,
        },
        overlayContainer: {
            // backgroundColor: therrTheme.colors.textWhite,
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
            // marginBottom: 10,
            // paddingBottom: 4,
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
            fontSize: 18,
            letterSpacing: 2,
            fontFamily: therrFontFamily,
        },
        headerTitleIcon: {
            // color: therrTheme.colors.accentAlt,
            marginRight: 10,
            height: 30,
            width: 30,
            borderRadius: 15,
        },
        subheader: {
            marginBottom: 10,
            display: 'flex',
            flexDirection: 'row',
            color: therrTheme.colors.accent3,
            borderBottomWidth: 2,
            borderBottomColor: therrTheme.colors.accentDivider,
            height: HEADER_HEIGHT - HEADER_EXTRA_HEIGHT,
            backgroundColor: therrTheme.colors.brandingBlueGreen,
            alignItems: 'center',
        },
        subheaderTitle: {
            display: 'flex',
            flexDirection: 'row',
            flex: 1,
            alignItems: 'center',
            marginLeft: 2,
        },
        subheaderTitleText: {
            color: therrTheme.colors.brandingWhite,
            fontSize: 15,
            fontFamily: therrFontFamily,
        },
        subheaderTitleIcon: {
            color: therrTheme.colors.brandingWhite,
            marginRight: 5,
            height: 24,
            width: 24,
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

    return ({
        ...therrTheme,
        styles,
    });
};

export {
    buildStyles,
};
