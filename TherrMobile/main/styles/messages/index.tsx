import { StyleSheet } from 'react-native';
import * as therrTheme from '../themes';

const containerStyles: any = {
    display: 'flex',
    padding: 5,
    paddingHorizontal: 12,
    borderRadius: 14,
    marginBottom: 7,
    marginLeft: '2%',
    marginRight: '2%',
};

const messageStyles = {
    color: therrTheme.colors.beemoTextBlack,
    fontSize: 16,
};

const messageDateStyles = {
    ...messageStyles,
    fontSize: 11,
    color: therrTheme.colors.textBlack,
};

export default StyleSheet.create({
    container: {
        display: 'flex',
        flexDirection: 'column',
        margin: 10,
        marginBottom: 0,
        flex: 1,
    },
    messageContainerLeft: {
        ...containerStyles,
        marginRight: '10%',
        backgroundColor: therrTheme.colors.backgroundGray,
        alignSelf: 'flex-start',
    },
    messageContainerRight: {
        ...containerStyles,
        marginLeft: '10%',
        backgroundColor: therrTheme.colors.beemo2,
        alignSelf: 'flex-end',
    },
    messageTextLeft: {
        ...messageStyles,
    },
    messageTextRight: {
        ...messageStyles,
    },
    messageDateLeft: {
        ...messageDateStyles,
    },
    messageDateRight: {
        ...messageDateStyles,
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
        justifyContent: 'center',
        paddingVertical: 12,
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
        padding: 0,
        margin: 0,
    },
    inputContainer: {
        display: 'flex',
        flex: 1,
    },
    sendBtn: {
        borderRadius: 25,
        backgroundColor: therrTheme.colors.primary3,
    },
    sendBtnContainer: {
        margin: 0,
        marginHorizontal: 4,
    },
});
