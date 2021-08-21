import { Platform, StyleSheet } from 'react-native';
import * as therrTheme from '../themes';

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

const iconStyle: any = {
    color: therrTheme.colors.textWhite,
    textShadowOffset: {
        width: 1,
        height: 1,
    },
    textShadowColor: '#rgba(27, 74, 105, .75)',
    textShadowRadius: 3,
};

const buttonsTitleStyle: any = {
    backgroundColor: 'transparent',
    color: therrTheme.colors.textWhite,
    fontSize: 10,
    marginTop: 5,
    paddingBottom: Platform.OS === 'ios' ? 10 : 0,
    ...iconStyle,
};

const notificationCircleStyles: any = {
    position: 'absolute',
    borderWidth: 4,
    borderRadius: 20,
    width: 4,
    height: 4,
    borderColor: therrTheme.colors.ternary,
    top: 12,
};

const tabStyles: any = {
    flex: 1,
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    height: 48,
};

export default StyleSheet.create({
    buttons: buttonStyle,
    buttonsActive: {
        ...buttonStyle,
    },
    buttonContainer: {
        display: 'flex',
        flex: 1,
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        margin: 0,
        height: '100%',
        borderRadius: 0,
    },
    buttonsTitle: buttonsTitleStyle,
    buttonsTitleActive: {
        ...buttonsTitleStyle,
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
    },
    containerInner: {
        display: 'flex',
        height: buttonMenuHeight,
        width: '100%',
        alignSelf: 'flex-end',
        flexDirection: 'row',
        marginTop: 100,
        backgroundColor: therrTheme.colors.primary,

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
    buttonIcon: iconStyle,
    buttonIconActive: {
        ...iconStyle,
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
        ...notificationCircleStyles,
        right: 25,
    },
    notificationCircleAlt: {
        ...notificationCircleStyles,
        right: 15,
    },
    tabsContainer: {
        display: 'flex',
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: therrTheme.colors.primary,
        shadowColor: 'black',
        shadowOffset: {
            height: 2,
            width: 0,
        },
        shadowRadius: 4,
        elevation: 1,
        shadowOpacity: 0.25,
        paddingHorizontal: 20,
    },
    tab: {
        ...tabStyles,
    },
    tabActive: {
        ...tabStyles,
        borderBottomWidth: 2,
        borderBottomColor: therrTheme.colors.backgroundCream,
    },
    tabText: {
        color: therrTheme.colors.textWhite,
    },
});
