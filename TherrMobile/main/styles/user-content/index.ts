import { StyleSheet } from 'react-native';
import * as therrTheme from '../themes';

export default StyleSheet.create({
    hashtagsContainer: {
        minHeight: 10,
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'flex-start',
        alignItems: 'center',
        flexDirection: 'row',
        marginBottom: 10,
        marginHorizontal: 14,
    },
    buttonPill: {
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 0,
        paddingHorizontal: 10,
        borderRadius: 20,
        height: 26,
        backgroundColor: therrTheme.colors.beemoTeal,
    },
    buttonPillIcon: {
        marginLeft: 8,
    },
    buttonPillContainer: {
        padding: 0,
        margin: 0,
        borderRadius: 20,
        height: 26,
        marginHorizontal: 4,
        marginTop: 14,
    },
    buttonPillTitle: {
        color: therrTheme.colors.beemoTextBlack,
    },
    preview: {
        paddingHorizontal: 20,
    },
});