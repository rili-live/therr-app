import { StyleSheet } from 'react-native';

export default StyleSheet.create({
    container: {
        display: 'flex',
        flexDirection: 'column',
        flex: 1,
        margin: 10,
    },
    item: {
        color: '#fcfeff',
    },
    sendInputsContainer: {
        display: 'flex',
        flexDirection: 'row',
        width: '100%',
        alignItems: 'center'
    },
    inputContainer: {
        flex: 1,
    },
    sendBtn: {
        borderRadius: 25,
    },
    sendBtnContainer: {
        marginBottom: 15,
    }
});
