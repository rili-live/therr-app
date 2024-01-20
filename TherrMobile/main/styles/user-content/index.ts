import { StyleSheet } from 'react-native';
import { medium } from '../layouts/spacing';

export default StyleSheet.create({
    hashtagsContainer: {
        minHeight: 10,
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'flex-start',
        alignItems: 'center',
        flexDirection: 'row',
        marginBottom: medium,
        marginHorizontal: 14,
    },
    preview: {
        paddingHorizontal: 20,
    },
    webview: {
        overflow: 'hidden',
    },
});
