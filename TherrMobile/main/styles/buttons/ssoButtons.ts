import { Platform, StyleSheet } from 'react-native';

export default StyleSheet.create({
    // GOOGLE
    googleButtonContainer: {
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        flex: 1,
    },
    googleButton: {
        backgroundColor: '#FFFFFF', // Google styles color
        flex: 1,
        alignItems: 'center',
        width: Platform.OS === 'ios' ? 'auto' : '100%',
    },
    googleButtonTitle: {
        color: '#6b6969', // Google styles color
        fontSize: 16,
        textAlign: 'center',
        paddingLeft: 12,
        paddingRight: 12,
        fontWeight: 'bold',
    },
    googleButtonIcon: {
        height: 22,
        width: 22,
        padding: 8,
    },

    // APPLE
    appleButtonIcon: {
        height: 22,
        width: 18,
        padding: 8,
    },
});
