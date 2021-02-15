import { StyleSheet } from 'react-native';
import * as therrTheme from '../themes';

export default StyleSheet.create({
    buttons: {
        backgroundColor: 'transparent',
        height: 50,
    },
    buttonsActive: {
        backgroundColor: 'transparent',
        height: 50,
    },
    buttonsTitle: {
        backgroundColor: 'transparent',
        color: therrTheme.colors.secondary,
        paddingRight: 10,
        paddingLeft: 10,
    },
    buttonsTitleActive: {
        backgroundColor: 'transparent',
        color: therrTheme.colors.secondary,
        paddingRight: 10,
        paddingLeft: 10,
    },
    dateTime: {
        marginBottom: 18,
        color: therrTheme.colorVariations.beemoTextBlack,
    },
    iconStyle: {
        color: therrTheme.colors.secondary,
        // position: 'absolute',
        // left: 20
    },
    momentContainer: {
        justifyContent: 'center',
        alignItems: 'center',
    },
    momentMessage: {
        fontSize: 20,
        marginBottom: 20,
        overflow: 'scroll',
        width: '90%',
    },
    momentUserAvatarImg: {
        height: 200,
        width: 200,
        borderRadius: 100,
        marginBottom: 12,
    },
    momentUserName: {
        fontSize: 16,
        fontWeight: '800',
        marginBottom: 14,
    },
    footer: {
        paddingRight: 20,
    },
    toggleIcon: {
        color: therrTheme.colors.textWhite,
    },
});
