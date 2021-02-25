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
    iconStyle: {
        color: therrTheme.colors.secondary,
        // position: 'absolute',
        // left: 20
    },
    container: {
        width: '100%',
        marginTop: 20,
        marginBottom: 4,
        padding: 20,
        paddingBottom: 4,
        paddingTop: 4,
        flex: 1,
    },
    categoriesContainer: {
        marginTop: 20,
        marginBottom: -10,
    },
    bodyEdit: {
        backgroundColor: therrTheme.colors.beemo1,
        padding: 0,
        flex: 1,
        marginTop: -30, // Helps cover theme background color
        paddingTop: 30, // Helps cover theme background color
        marginBottom: -30, // Helps cover theme background color
        paddingBottom: 30, // Helps cover theme background color
    },
    bodyEditScroll: {
        color: therrTheme.colors.textWhite,
        justifyContent: 'center',
        backgroundColor: therrTheme.colors.beemo1,
        paddingBottom: 100,
    },
    bodyView: {
        backgroundColor: therrTheme.colors.beemo1,
        padding: 0,
        height: '100%',
        marginTop: -30, // Helps cover theme background color
        paddingTop: 30, // Helps cover theme background color
        marginBottom: -30, // Helps cover theme background color
        paddingBottom: 30, // Helps cover theme background color
    },
    bodyViewScroll: {
        backgroundColor: therrTheme.colors.beemo1,
        paddingBottom: 100,
    },
    footer: {
        display: 'flex',
        height: 80,
        flex: 1,
        paddingRight: 30,
        position: 'absolute',
        bottom: 0,
        alignItems: 'flex-end',
        justifyContent: 'center',
        width: '100%',
    },
});
