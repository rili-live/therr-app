import { Platform, StyleSheet } from 'react-native';
import { IMobileThemeName } from 'therr-react/types';
import { therrFontFamily } from '../font';
import { getTheme, ITherrTheme } from '../themes';

export const buttonMenuHeight = Platform.OS === 'ios' ? 80 : 60;
export const buttonMenuHeightCompact = 48;

const buttonStyle: any = {
    backgroundColor: 'transparent',
    display: 'flex',
    flexDirection: 'column',
    flex: 1,
    width: '100%',
    borderRadius: 0,
};

const getIconStyle = (theme: ITherrTheme) => ({
    color: theme.colorVariations.backgroundCreamLighten,
    // textShadowOffset: {
    //     width: 1,
    //     height: 1,
    // },
    // textShadowColor: '#rgba(27, 74, 105, .75)',
    // textShadowRadius: 1,
});

const getButtonContainerStyle: any = () => ( {
    display: 'flex',
    flex: 1,
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    margin: 0,
    height: '100%',
    borderRadius: 0,
});

const getButtonsTitleStyle = (theme: ITherrTheme) => ({
    backgroundColor: 'transparent',
    fontSize: 10,
    marginTop: 5,
    paddingBottom: Platform.OS === 'ios' ? 10 : 0,
    fontFamily: therrFontFamily,
    ...getIconStyle(theme),
});

const getNotificationCircleStyles = (theme: ITherrTheme): any => ({
    position: 'absolute',
    borderWidth: 4,
    borderRadius: 20,
    width: 4,
    height: 4,
    borderColor: theme.colors.brandingRed,
    top: 12,
});

const tabStyles: any = {
    flex: 1,
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    height: 48,
};

const buildStyles = (themeName?: IMobileThemeName) => {
    const therrTheme = getTheme(themeName);
    const styles = StyleSheet.create({
        buttons: buttonStyle,
        buttonsActive: {
            ...buttonStyle,
        },
        buttonContainer: {
            ...getButtonContainerStyle(therrTheme),
        },
        buttonContainerActive: {
            ...getButtonContainerStyle(therrTheme),
            borderTopWidth: 4,
            borderColor: therrTheme.colors.brandingOrange,
        },
        buttonContainerUserProfile: {
            ...getButtonContainerStyle(therrTheme),
        },
        buttonContainerUserProfileActive: {
            ...getButtonContainerStyle(therrTheme),
            borderTopWidth: 4,
            borderColor: therrTheme.colors.brandingOrange,
        },
        buttonsTitle: getButtonsTitleStyle(therrTheme),
        buttonsTitleActive: {
            ...getButtonsTitleStyle(therrTheme),
            textShadowOffset: {
                width: 0,
                height: 0,
            },
            color: therrTheme.colors.primary3,
        },
        container: {
            position: 'absolute',
            display: 'flex',
            height: buttonMenuHeight,
            width: '100%',
            alignSelf: 'flex-end',
            flexDirection: 'row',
            zIndex: 10,
            backgroundColor: 'transparent',
            bottom: 0,
        },
        containerInner: {
            display: 'flex',
            height: buttonMenuHeight,
            width: '100%',
            alignSelf: 'flex-end',
            flexDirection: 'row',
            marginTop: 100,
            backgroundColor: therrTheme.colors.primary,
            // backgroundColor: therrTheme.colorVariations.backgroundCreamLighten,
            borderTopWidth: 1,
            borderTopColor: therrTheme.colors.accentDivider,

            // Shadow
            // shadowColor: therrTheme.colors.textBlack,
            // shadowOffset: {
            //     height: -5,
            //     width: 0,
            // },
            // shadowRadius: 4,
            // elevation: 2,
            // shadowOpacity: 0.5,
        },
        buttonIcon: getIconStyle(therrTheme),
        buttonIconActive: {
            ...getIconStyle(therrTheme),
            textShadowOffset: {
                width: 0,
                height: 0,
            },
            textShadowRadius: 0,
            color: therrTheme.colors.primary3,
        },
        notificationContainer: {
            display: 'flex',
            flex: 1,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
        },
        notificationCircle: {
            ...getNotificationCircleStyles(therrTheme),
            right: 25,
        },
        notificationCircleAlt: {
            ...getNotificationCircleStyles(therrTheme),
            right: 15,
        },
        notificationCircle2: {
            ...getNotificationCircleStyles(therrTheme),
            top: 9,
            right: 15,
            width: 4,
            height: 4,
            position: 'absolute',
            borderWidth: 4,
            borderRadius: 3,
            borderColor: therrTheme.colors.brandingOrange,
        },
        tab: {
            ...tabStyles,
        },
        tabBar: {
            backgroundColor: therrTheme.colors.primary,
        },
        tabActive: {
            ...tabStyles,
            borderBottomWidth: 2,
            borderBottomColor: therrTheme.colors.backgroundCream,
        },
        tabText: {
            color: therrTheme.colorVariations.textWhiteLightFade,
            fontFamily: therrFontFamily,
            textAlign: 'center',
        },
        tabTextFocused: {
            color: therrTheme.colors.textWhite,
            fontFamily: therrFontFamily,
            textAlign: 'center',
        },
        tabFocusedIndicator: {
            backgroundColor: therrTheme.colors.primary3,
        },
        submitButtonContainerFloat: {
            width: '100%',
            position: 'absolute',
            marginBottom: 20,
            marginTop: 20,
            paddingHorizontal: 20,
            bottom: buttonMenuHeight,
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
