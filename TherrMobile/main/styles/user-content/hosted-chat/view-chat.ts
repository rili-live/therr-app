import { StyleSheet } from 'react-native';
import * as therrTheme from '../../themes';

export default StyleSheet.create({
    container: {
        marginTop: 0,
        marginBottom: 80,
    },
    sendBtnContainer: {
        marginHorizontal: 0,
    },
    messageContainer: {
        display: 'flex',
        flexDirection: 'row',
        marginVertical: 3,
        backgroundColor: therrTheme.colorVariations.beemoTextWhiteFade,
        paddingHorizontal: 4,
        paddingVertical: 10,
        borderRadius: 4,
        elevation: 3,
        borderLeftWidth: 5,
        paddingLeft: 10,
    },
    messageContentContainer: {
        flex: 1,
    },
    messageHeader: {
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'flex-end',
        paddingBottom: 3,
    },
    senderTitleText: {
        color: therrTheme.colors.beemoTextBlack,
        fontSize: 15,
        fontWeight: 'bold',
        paddingRight: 4,
    },
    messageTime: {
        fontSize: 12,
    },
    messageText: {
        color: therrTheme.colors.beemoTextBlack,
        fontSize: 15,
        flex: 1,
    },
    footer: {
        paddingHorizontal: 10,
    },
});
