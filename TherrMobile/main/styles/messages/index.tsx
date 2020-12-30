import { StyleSheet } from 'react-native';
import * as therrTheme from '../themes';

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
    sectionContainer: {
        display: 'flex',
        flexDirection: 'row',
        marginTop: 16,
        marginBottom: 16,
        paddingHorizontal: 12,
    },
    sendInputsContainer: {
        display: 'flex',
        flexDirection: 'row',
        width: '100%',
        alignItems: 'center',
    },
    userImage: {
        // color: therrTheme.colors.primary3,
        marginRight: 10,
        height: 30,
        width: 30,
        borderRadius: 15,
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
