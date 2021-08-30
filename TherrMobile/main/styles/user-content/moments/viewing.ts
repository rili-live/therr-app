import { StyleSheet } from 'react-native';
import * as therrTheme from '../../themes';

const momentUserAvatarImgPadding = 2;
const momentUserAvatarImgWidth = 52 - (2 * momentUserAvatarImgPadding);
const momentUserAvatarImgRadius = momentUserAvatarImgWidth / 2;
const contentTitleContainerHeight = 38;

const buttonContainerStyles: any = {
    display: 'flex',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
};

const buttonStyle: any = {
    height: '100%',
};

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
        paddingTop: 4,
        paddingBottom: 2,
        paddingLeft: 4,
    },
    momentUserName: {
        fontSize: 15,
        paddingBottom: 1,
        color: isDarkMode ? therrTheme.colors.beemoTextWhite : therrTheme.colors.tertiary,
    },
    dateTime: {
        fontSize: 11,
        color: isDarkMode ? therrTheme.colors.beemoTextWhite : therrTheme.colors.tertiary,
    },
    moreButtonContainer: {
        ...buttonContainerStyles,
    },
    moreButton: {
        ...buttonStyle,
    },
    bookmarkButtonContainer: {
        ...buttonContainerStyles,
    },
    bookmarkButton: {
        ...buttonStyle,
    },
    momentContentTitleContainer: {
        display: 'flex',
        flex: 1,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'flex-start',
        width: '100%',
        paddingBottom: 0,
        paddingHorizontal: 2,
        position: 'relative',
        maxHeight: contentTitleContainerHeight,
    },
    momentContentTitle: {
        flex: 1,
        color: isDarkMode ? therrTheme.colors.beemoTextWhite : therrTheme.colors.tertiary,
        // position: 'absolute',
        fontSize: 18,
        // top: 10,
        paddingVertical: ((contentTitleContainerHeight - 18) / 2) - 3,
        paddingHorizontal: 6,
        height: '100%',
        fontWeight: 'bold',
    },
    momentMessage: {
        fontSize: 15,
        color: isDarkMode ? therrTheme.colors.beemoTextWhite : therrTheme.colors.tertiary,
        overflow: 'scroll',
        width: '100%',
        paddingHorizontal: 14,
        paddingBottom: 4,
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
