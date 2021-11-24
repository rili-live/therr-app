import { StyleSheet } from 'react-native';
import * as therrTheme from '../themes';

export default StyleSheet.create({
    overlay: {
        flex: 1,
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'flex-end',
        // backgroundColor: 'rgba(0,0,0,0.25)',
    },
    container: {
        display: 'flex',
        justifyContent: 'flex-start',
        alignItems: 'center',
        width: '100%',
        padding: 10,
        paddingBottom: 40,
        backgroundColor: therrTheme.colors.backgroundGray,
        borderTopWidth: 2,
        borderTopColor: therrTheme.colors.primary,
        // borderTopRightRadius: 15,
        // borderTopLeftRadius: 15,
        elevation: 5,
    },
});
