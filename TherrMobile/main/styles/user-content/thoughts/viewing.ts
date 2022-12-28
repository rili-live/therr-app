import { StyleSheet } from 'react-native';
import { IMobileThemeName } from 'therr-react/types';
import { getTheme } from '../../themes';

const thoughtUserAvatarImgPadding = 4;
const thoughtUserAvatarImgWidth = 52 - (2 * thoughtUserAvatarImgPadding);
const thoughtUserAvatarImgRadius = thoughtUserAvatarImgWidth / 2;
const contentTitleContainerHeight = 40;

const buttonContainerStyles: any = {
    display: 'flex',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
};

const buttonStyle: any = {
    height: '100%',
};

const buildStyles = (themeName?: IMobileThemeName, isDarkMode = true) => {
    const therrTheme = getTheme(themeName);

    const styles = StyleSheet.create({
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
        thoughtContainer: {
            display: 'flex',
            flexDirection: 'row',
        },
        thoughtLeftContainer: {},
        thoughtRightContainer: {
            flex: 1,
        },
        thoughtUserAvatarImgContainer: {
            width: thoughtUserAvatarImgWidth,
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            padding: 0,
        },
        thoughtUserAvatarImg: {
            height: thoughtUserAvatarImgWidth - (thoughtUserAvatarImgPadding * 2),
            width: thoughtUserAvatarImgWidth - (thoughtUserAvatarImgPadding * 2),
            borderRadius: thoughtUserAvatarImgRadius,
            margin: thoughtUserAvatarImgPadding,
        },
        thoughtContentContainer: {
            display: 'flex',
            flexDirection: 'row',
            paddingLeft: 4,
        },
        thoughtAuthorContainer: {
            display: 'flex',
            flex: 1,
            flexDirection: 'row',
            justifyContent: 'center',
            alignItems: 'flex-start',
            width: '100%',
            paddingBottom: 5,
            paddingHorizontal: 2,
            height: thoughtUserAvatarImgWidth,
            maxHeight: thoughtUserAvatarImgWidth,
            position: 'relative',
            boxSizing: 'border-box',
        },
        thoughtAuthorTextContainer: {
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-start',
            justifyContent: 'center',
            flex: 1,
            paddingTop: 4,
            paddingBottom: 2,
        },
        thoughtUserName: {
            fontSize: 15,
            fontWeight: '600',
            paddingBottom: 1,
            color: isDarkMode ? therrTheme.colors.accentTextWhite : therrTheme.colors.tertiary,
        },
        dateTime: {
            fontSize: 11,
            color: isDarkMode ? therrTheme.colorVariations.accentTextWhiteFade : therrTheme.colors.tertiary,
        },
        moreButtonContainer: {
            ...buttonContainerStyles,
        },
        moreButton: {
            ...buttonStyle,
        },
        thoughtReactionButtonContainer: {
            ...buttonContainerStyles,
        },
        thoughtReactionButton: {
            ...buttonStyle,
        },
        thoughtReactionsContainer: {
            display: 'flex',
            flex: 1,
            width: '100%',
            flexDirection: 'row',
            justifyContent: 'space-around',
            alignItems: 'flex-start',
            paddingBottom: 0,
            paddingHorizontal: 2,
            position: 'relative',
            maxHeight: contentTitleContainerHeight,
        },
        thoughtContentTitle: {
            flex: 1,
            color: isDarkMode ? therrTheme.colors.accentTextWhite : therrTheme.colors.tertiary,
            // position: 'absolute',
            fontSize: 18,
            fontWeight: '600',
            // top: 10,
            paddingVertical: ((contentTitleContainerHeight - 18) / 2) - 3,
            paddingHorizontal: 6,
            height: '100%',
        },
        thoughtMessage: {
            fontSize: 16,
            color: isDarkMode ? therrTheme.colors.accentTextWhite : therrTheme.colors.tertiary,
            overflow: 'scroll',
            width: '100%',
            paddingRight: 14,
            paddingBottom: 4,
        },
        thoughtDistance: {
            color: isDarkMode ? therrTheme.colors.textGray : therrTheme.colors.tertiary,
            width: '100%',
            paddingHorizontal: 10,
            fontFamily: 'Lexend-Regular',
            textAlign: 'left',
        },
        footer: {
            paddingRight: 20,
        },
        toggleIcon: {
            color: therrTheme.colors.textWhite,
        },
    });

    return ({
        ...therrTheme,
        styles,
    });
};

export {
    buildStyles,
};
