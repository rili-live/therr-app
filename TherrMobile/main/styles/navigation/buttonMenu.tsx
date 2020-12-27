import { StyleSheet } from 'react-native';
import * as therrTheme from '../themes';

export const buttonMenuHeight = 74;

const buttonStyle: any = {
    backgroundColor: 'transparent',
    display: 'flex',
    flexDirection: 'column',
    flex: 1,
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
    ...iconStyle,
};

export default StyleSheet.create({
    buttons: buttonStyle,
    buttonsActive: {
        ...buttonStyle,
    },
    buttonContainer: {
        display: 'flex',
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
    },
    buttonsTitle: buttonsTitleStyle,
    buttonsTitleActive: {
        ...buttonsTitleStyle,
        textShadowOffset: {
            width: 0,
            height: 0,
        },
    },
    container: {
        position: 'absolute',
        display: 'flex',
        height: buttonMenuHeight,
        width: '100%',
        alignSelf: 'flex-end',
        flexDirection: 'row',
        borderRadius: 0,
        padding: 0,
        bottom: 0,
    },
    buttonIcon: iconStyle,
    buttonIconActive: {
        ...iconStyle,
        textShadowOffset: {
            width: 0,
            height: 0,
        },
        textShadowRadius: 0,
    },
    notificationCircle: {
        position: 'absolute',
        borderWidth: 4,
        borderRadius: 20,
        width: 4,
        height: 4,
        borderColor: therrTheme.colors.ternary,
        right: 30,
        top: 12,
    },
});
