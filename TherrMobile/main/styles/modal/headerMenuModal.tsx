import { StyleSheet } from 'react-native';

export default StyleSheet.create({
    buttons: {
        backgroundColor: 'transparent',
        color: '#388254',
    },
    container: {
        display: 'flex',
        height: '100%',
        width: '90%',
        alignSelf: 'flex-end',
        flexDirection: 'column',
        borderRadius: 0,
        padding: 0,
    },
    header: {
        paddingTop: 4,
        display: 'flex',
        flexDirection: 'row',
        color: '#388254',
    },
    headerTitle: {
        color: '#388254',
        display: 'flex',
        flex: 1,
        justifyContent: 'center',
        alignContent: 'center',
        fontSize: 18,
    },
});
