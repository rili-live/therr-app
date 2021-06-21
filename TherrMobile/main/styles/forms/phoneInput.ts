import { Platform, StyleSheet } from 'react-native';

export default StyleSheet.create({
    phoneInputContainer: {
        position: 'relative',
        display: 'flex',
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        width: '100%',
        padding: 0,
        margin: 0,
        marginBottom: 6,
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
        marginBottom: Platform.OS !== 'ios' ? 20 : 10,
        position: 'absolute',
        right: 12,
        bottom: 14,
    },
});
