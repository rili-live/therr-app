import { StyleSheet } from 'react-native';
import * as therrTheme from '../themes';

export default StyleSheet.create({
    loginContainer: {
        backgroundColor: 'transparent',
        borderRadius: 16,
        marginTop: '4%',
        marginBottom: '4%',
        maxWidth: '100%',
        minWidth: '98%',
        padding: 24,
    },
    button: {
        backgroundColor: therrTheme.colors.primary3,
    },
    buttonLink: {
        color: therrTheme.colors.primary3,
    },
    phoneInputContainer: {
        position: 'relative',
        display: 'flex',
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        width: '100%',
        padding: 0,
        margin: 0,
    },
    countryFlag: {
        position: 'relative',
        padding: 0,
        margin: 0,
        zIndex: 100,
        marginLeft: 15,
        width: 32,
        display: 'flex',
    },
    pickerCloseButton: {
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'flex-end',
        width: '100%',
        paddingRight: 10,
    },
    countryFlagContainer: {
        marginBottom: 20,
        position: 'absolute',
        right: 20,
        bottom: 10,
    },
    submitButtonContainer: {
        marginTop: 18,
        marginBottom: 20,
    },
    moreLinksContainer: {
        marginTop: 18,
        marginBottom: 20,
    },
});
