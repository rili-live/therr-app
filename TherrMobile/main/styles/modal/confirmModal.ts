import { StyleSheet } from 'react-native';
import * as therrTheme from '../themes';

export default StyleSheet.create({
    overlay: {
        flex: 1,
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
    },
    container: {
        display: 'flex',
        justifyContent: 'flex-start',
        alignItems: 'center',
        width: '75%',
        backgroundColor: therrTheme.colors.backgroundGray,
        elevation: 5,
        borderRadius: 12,
    },
    header: {
        fontSize: 20,
        fontWeight: '400',
        padding: 10,
        paddingVertical: 20,
        textAlign: 'center',
    },
    buttonsContainer: {
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        borderTopColor: therrTheme.colorVariations.textBlackFade,
        borderTopWidth: 1,
    },
    buttonContainer: {
        flex: 1,
        borderRightColor: therrTheme.colorVariations.textBlackFade,
        borderTopRightRadius: 0,
        borderBottomRightRadius: 0,
    },
    text: {
        paddingBottom: 5,
    },
});
