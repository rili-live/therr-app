import { StyleSheet } from 'react-native';
import * as therrTheme from '../../themes';

const momentUserAvatarImgPadding = 2;
const momentUserAvatarImgWidth = 50 - (2 * momentUserAvatarImgPadding);
const momentUserAvatarImgRadius = momentUserAvatarImgWidth / 2;

const getViewingMomentStyles = ({
    isDarkMode,
}) => StyleSheet.create({
    buttons: {
        backgroundColor: 'transparent',
        height: 50,
    },
    buttonsActive: {
        backgroundColor: 'transparent',
        height: 50,
    },
    buttonsTitle: {
        backgroundColor: 'transparent',
        color: therrTheme.colors.secondary,
        paddingRight: 10,
        paddingLeft: 10,
    },
    buttonsTitleActive: {
        backgroundColor: 'transparent',
        color: therrTheme.colors.secondary,
        paddingRight: 10,
        paddingLeft: 10,
    },
    iconStyle: {
        color: therrTheme.colors.secondary,
        // position: 'absolute',
        // left: 20
    },
    momentContainer: {
        justifyContent: 'center',
        alignItems: 'center',
        padding: 0,
        paddingHorizontal: 0,
        marginTop: 0,
        marginBottom: 32,
    },
    momentUserAvatarImgContainer: {
        height: '100%',
        borderRadius: momentUserAvatarImgRadius,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 0,
    },
    momentUserAvatarImg: {
        height: momentUserAvatarImgWidth,
        width: momentUserAvatarImgWidth,
        padding: momentUserAvatarImgPadding,
    },
    momentAuthorContainer: {
        display: 'flex',
        flex: 1,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'flex-start',
        width: '100%',
        paddingBottom: 5,
        paddingHorizontal: 2,
        height: momentUserAvatarImgWidth,
        maxHeight: momentUserAvatarImgWidth,
        position: 'relative',
    },
    momentAuthorTextContainer: {
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        justifyContent: 'center',
        flex: 1,
        paddingTop: 3,
        paddingBottom: 1,
        paddingLeft: 4,
    },
    momentUserName: {
        fontSize: 15,
        paddingBottom: 1,
        color: isDarkMode ? therrTheme.colors.beemoTextWhite : therrTheme.colors.beemoTextBlack,
    },
    dateTime: {
        fontSize: 11,
        color: isDarkMode ? therrTheme.colors.beemoTextWhite : therrTheme.colors.beemoTextBlack,
    },
    momentMessage: {
        fontSize: 16,
        color: isDarkMode ? therrTheme.colors.beemoTextWhite : therrTheme.colors.beemoTextBlack,
        overflow: 'scroll',
        width: '100%',
        paddingHorizontal: 5,
        paddingVertical: 4,
    },
    footer: {
        paddingRight: 20,
    },
    toggleIcon: {
        color: therrTheme.colors.textWhite,
    },
});

export {
    getViewingMomentStyles,
};

export default getViewingMomentStyles({
    isDarkMode: false,
});
