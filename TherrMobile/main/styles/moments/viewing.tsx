import { StyleSheet } from 'react-native';
import * as therrTheme from '../themes';

const containerBackgroundColor = therrTheme.colors.textWhite;
// const brandingYellow = '#ebc300';

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
    container: {
        backgroundColor: containerBackgroundColor,
        display: 'flex',
        height: '100%',
        width: '92%',
        alignSelf: 'flex-end',
        flexDirection: 'column',
        borderRadius: 0,
        padding: 0,
    },
    body: {
        backgroundColor: therrTheme.colors.beemo1,
        padding: 0,
        height: '100%',
    },
    bodyScroll: {
        backgroundColor: therrTheme.colors.beemo1,
        paddingBottom: 80,
    },
    momentContainer: {
        width: '100%',
        marginTop: 0,
        marginBottom: 4,
        padding: 20,
        paddingBottom: 4,
        paddingTop: 4,
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    momentMessage: {
        fontSize: 20,
        marginBottom: 20,
        overflow: 'scroll',
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
        display: 'flex',
        height: 80,
        flex: 1,
        paddingRight: 20,
        position: 'absolute',
        bottom: 0,
        alignItems: 'flex-end',
        justifyContent: 'center',
        width: '100%',
    },
    toggleIcon: {
        color: therrTheme.colors.textWhite,
    },
});
