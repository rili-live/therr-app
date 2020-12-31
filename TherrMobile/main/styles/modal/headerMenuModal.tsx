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
        color: therrTheme.colors.beemoAlt,
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
        color: therrTheme.colors.beemoAlt,
        // position: 'absolute',
        // left: 20
    },
    iconStyleActive: {
        color: therrTheme.colors.primary,
        // position: 'absolute',
        // left: 20
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
        marginTop: 4,
        marginBottom: 10,
        paddingBottom: 4,
        display: 'flex',
        flexDirection: 'row',
        color: therrTheme.colors.beemo3,
        borderBottomWidth: 2,
        borderBottomColor: '#4950571c',
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
        // color: therrTheme.colors.beemoAlt,
        marginRight: 10,
        height: 30,
        width: 30,
        borderRadius: 15,
    },
    body: {
        position: 'relative',
        width: '100%',
        flex: 1,
    },
    footer: {
        display: 'flex',
        paddingBottom: 8,
        position: 'absolute',
        bottom: 0,
        alignItems: 'center',
        width: '100%',
    },
    toggleIcon: {
        height: 30,
        width: 30,
        borderRadius: 15,
    },
    toggleIconDark: {
        height: 30,
        width: 30,
        borderRadius: 15,
    },
});
