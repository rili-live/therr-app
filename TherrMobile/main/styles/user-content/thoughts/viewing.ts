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

const thoughtReactionsContainerStyles: any = {
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
        inspectThoughtContainer: {
            justifyContent: 'flex-start',
            alignItems: 'center',
            padding: 0,
            paddingHorizontal: 0,
            marginTop: 0,
            // marginBottom: 32,
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
        thoughtReactionButtonTitle: {
            fontSize: 14,
            paddingLeft: 2,
        },
        thoughtReactionsContainer: {
            ...thoughtReactionsContainerStyles,
        },
        thoughtReactionsContainerExpanded: {
            ...thoughtReactionsContainerStyles,
            borderBottomWidth: 1,
            borderTopWidth: 1,
            borderColor: isDarkMode ? therrTheme.colors.accentDivider : therrTheme.colors.tertiary,
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
        sendBtnIcon: {
            color: therrTheme.colors.brandingWhite,
            padding: 0,
            margin: 0,
        },
        sendBtn: {
            borderRadius: 25,
            backgroundColor: therrTheme.colors.primary3,
        },
        sendBtnContainer: {
            margin: 0,
            marginHorizontal: 4,
            alignSelf: 'center',
        },
        sendBtnInput: {
            flex: 1,
            margin: 0,
            marginBottom: 10,
            marginVertical: 10,
            fontSize: 18,
            lineHeight: 20,
            paddingTop: 18,
            paddingBottom: 18,
        },
        sendInputsContainer: {
            display: 'flex',
            flexDirection: 'row',
            width: '100%',
            alignItems: 'center',
            justifyContent: 'center',
            paddingBottom: 0,
            marginBottom: 0,

            borderBottomWidth: 1,
            borderColor: isDarkMode ? therrTheme.colors.accentDivider : therrTheme.colors.tertiary,
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
