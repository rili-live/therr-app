import { StyleSheet } from 'react-native';

export default StyleSheet.create({
    buttons: {
        backgroundColor: 'transparent',
        display: 'flex',
        flexDirection: 'column',
        flex: 1,
    },
    buttonsActive: {
        backgroundColor: 'transparent',
    },
    buttonContainer: {
        display: 'flex',
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
    },
    buttonsTitle: {
        backgroundColor: 'transparent',
        color: 'white',
        fontSize: 10,
    },
    buttonsTitleActive: {
        backgroundColor: 'transparent',
        color: 'white',
        textDecorationLine: 'underline',
    },
    container: {
        position: 'absolute',
        display: 'flex',
        height: '15%',
        width: '100%',
        alignSelf: 'flex-end',
        flexDirection: 'row',
        borderRadius: 0,
        padding: 0,
        bottom: 0,
    },
    header: {
        paddingTop: 4,
        display: 'flex',
        flexDirection: 'row',
        color: 'white',
    },
    headerTitle: {
        color: 'white',
        display: 'flex',
        flex: 1,
        justifyContent: 'center',
        alignContent: 'center',
        fontSize: 18,
    },
});
