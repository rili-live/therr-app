import { StyleSheet } from 'react-native';

// Shared by HeaderSearchInput and HeaderSearchUsersInput so the two header
// search variants stay visually identical when one is tweaked.
export default StyleSheet.create({
    flex: {
        flex: 1,
    },
    flexRow: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
    },
    iconButton: {
        paddingHorizontal: 4,
        alignItems: 'center',
        justifyContent: 'center',
    },
    textInputBase: {
        margin: 0,
        padding: 0,
        paddingVertical: 0,
        paddingHorizontal: 0,
        backgroundColor: 'transparent',
    },
    fontSizeDefault: {
        fontSize: 16,
    },
    fontSizeIos: {
        fontSize: 19,
    },
});
