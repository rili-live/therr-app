import { StyleSheet } from 'react-native';
import * as therrTheme from '../themes/ocean';

export default StyleSheet.create({
    container: {
        display: 'flex',
        flexDirection: 'column',
        flex: 1,
        margin: 10,
    },
    item: {
        color: therrTheme.colors.textWhite,
    },
    sendInputsContainer: {
        display: 'flex',
        flexDirection: 'row',
        width: '100%',
        alignItems: 'center',
    },
    icon: {
        color: therrTheme.colors.textWhite,
    },
    inputContainer: {
        flex: 1,
    },
    sendBtn: {
        borderRadius: 25,
    },
    sendBtnContainer: {
        marginBottom: 15,
    },
});
