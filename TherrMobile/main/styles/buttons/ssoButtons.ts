import { StyleSheet } from 'react-native';

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
        borderRadius: 4,
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
        height: 26,
        width: 26,
        padding: 8,
        marginLeft: 12,
    },

    // APPLE
    appleButtonContainer: {
        width: '74%', // You must specify a width
        height: 40, // You must specify a height
        elevation: 3,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        flex: 1,
        borderRadius: 9,
        alignSelf: 'center',
    },
    appleButtonIcon: {
        height: 22,
        width: 18,
        padding: 8,
    },
});
