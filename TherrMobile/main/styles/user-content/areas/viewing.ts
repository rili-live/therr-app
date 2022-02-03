import { StyleSheet } from 'react-native';
import { IMobileThemeName } from 'therr-react/types';
import { getTheme } from '../../themes';

const areaUserAvatarImgPadding = 2;
const areaUserAvatarImgWidth = 52 - (2 * areaUserAvatarImgPadding);
const areaUserAvatarImgRadius = areaUserAvatarImgWidth / 2;
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
        areaContainer: {
            justifyContent: 'center',
            alignItems: 'center',
            padding: 0,
            paddingHorizontal: 0,
            marginTop: 0,
            marginBottom: 32,
        },
        areaUserAvatarImgContainer: {
            height: '100%',
            borderRadius: areaUserAvatarImgRadius,
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            padding: 0,
        },
        areaUserAvatarImg: {
            height: areaUserAvatarImgWidth,
            width: areaUserAvatarImgWidth,
            padding: areaUserAvatarImgPadding,
        },
        areaAuthorContainer: {
            display: 'flex',
            flex: 1,
            flexDirection: 'row',
            justifyContent: 'center',
            alignItems: 'flex-start',
            width: '100%',
            paddingBottom: 5,
            paddingHorizontal: 2,
            height: areaUserAvatarImgWidth,
            maxHeight: areaUserAvatarImgWidth,
            position: 'relative',
        },
        areaAuthorTextContainer: {
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
        areaUserName: {
            fontSize: 15,
            fontWeight: '500',
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
        bookmarkButtonContainer: {
            ...buttonContainerStyles,
        },
        bookmarkButton: {
            ...buttonStyle,
        },
        areaContentTitleContainer: {
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
        areaContentTitle: {
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
        areaMessage: {
            fontSize: 16,
            color: isDarkMode ? therrTheme.colors.accentTextWhite : therrTheme.colors.tertiary,
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

    return ({
        ...therrTheme,
        styles,
    });
};

export {
    buildStyles,
};
