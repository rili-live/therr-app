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
    overlayText: {
        // position: 'absolute',
        fontSize: 18,
        // top: 10,
        width: '100%',
        paddingVertical: 3,
        paddingHorizontal: 8,
        color: therrTheme.colors.textWhite,
    },
    preview: {
        paddingHorizontal: 20,
    },
    webview: {
        overflow: 'hidden',
    },
});
