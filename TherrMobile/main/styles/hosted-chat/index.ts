import { StyleSheet } from 'react-native';
import * as therrTheme from '../themes';

export const EDGE_PADDING = 6;

export default StyleSheet.create({
    searchContainer: {
        display: 'flex',
        flexDirection: 'row',
        marginTop: 10,
        paddingHorizontal: 0,
    },
    searchInputContainer: {
        flex: 1,
        display: 'flex',
    },
    searchInputError: {
        height: 5,
    },
    searchButton: {
    },
    searchIcon: {
    },
    scrollContentContainer: {
        paddingHorizontal: EDGE_PADDING * 2,
    },
    createChatBtnContainer: {
        position: 'absolute',
        right: 18,
        bottom: 18,
        shadowColor: therrTheme.colors.textBlack,
        shadowOffset: {
            height: 1,
            width: 1,
        },
        shadowRadius: 4,
        borderRadius: 100,
        padding: 0,
    },
});
