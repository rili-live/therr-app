import { StyleSheet } from 'react-native';
import { IMobileThemeName } from 'therr-react/types';
import { therrFontFamily } from '../../font';
import { getTheme, ITherrTheme } from '../../themes';

const areaUserAvatarImgPadding = 4;
const areaUserAvatarImgWidth = 52 - (2 * areaUserAvatarImgPadding);
const areaUserAvatarImgRadius = areaUserAvatarImgWidth / 2;
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

const getAreaDistanceStyle = (therrTheme: ITherrTheme, isDarkMode = true): any => ({
    color: isDarkMode ? therrTheme.colors.textGray : therrTheme.colors.tertiary,
    width: '100%',
    paddingHorizontal: 10,
    fontFamily: therrFontFamily,
    textAlign: 'left',
});

const getCardStyles = (therrTheme: ITherrTheme): any => ({
    display: 'flex',
    flexDirection: 'column',
    flex: 1,
    padding: 0,
    elevation: 2,
    backgroundColor: therrTheme.colors.backgroundWhite,
    borderRadius: 5,
    paddingBottom: 5,
    marginHorizontal: 7,
    shadowRadius: 5,
    shadowOpacity: 0.3,
    shadowOffset: {
        width: 2,
        height: -2,
    },
    overflow: 'hidden',
    marginBottom: 3,
});

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
            width: areaUserAvatarImgWidth,
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            padding: 0,
        },
        areaUserAvatarImg: {
            height: areaUserAvatarImgWidth - (areaUserAvatarImgPadding * 2),
            width: areaUserAvatarImgWidth - (areaUserAvatarImgPadding * 2),
            borderRadius: areaUserAvatarImgRadius,
            margin: areaUserAvatarImgPadding,
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
            boxSizing: 'border-box',
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
        areaReactionButtonContainer: {
            ...buttonContainerStyles,
        },
        areaReactionButton: {
            ...buttonStyle,
        },
        areaReactionButtonTitle: {
            fontSize: 14,
            paddingLeft: 2,
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
        areaContentTitleMedium: {
            flex: 1,
            color: isDarkMode ? therrTheme.colors.accentTextWhite : therrTheme.colors.tertiary,
            // position: 'absolute',
            fontSize: 16,
            fontWeight: '600',
            // top: 10,
            paddingVertical: ((contentTitleContainerHeight - 16) / 2) - 3,
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
        eventText: {
            fontSize: 16,
            fontWeight: '600',
            fontFamily: therrFontFamily,
            color: isDarkMode ? therrTheme.colors.accentTextWhite : therrTheme.colors.tertiary,
        },
        areaDistance: {
            ...getAreaDistanceStyle(therrTheme, isDarkMode),
        },
        areaDistanceCenter: {
            ...getAreaDistanceStyle(therrTheme, isDarkMode),
            textAlign: 'center',
        },
        areaDistanceRight: {
            ...getAreaDistanceStyle(therrTheme, isDarkMode),
            textAlign: 'right',
            fontSize: 11,
        },
        footer: {
            paddingRight: 20,
        },
        toggleIcon: {
            color: therrTheme.colors.textWhite,
        },
        banner: {
            marginBottom: 10,
            display: 'flex',
            flexDirection: 'row',
            color: therrTheme.colors.accent3,
            borderBottomWidth: 2,
            borderBottomColor: therrTheme.colors.accentDivider,
            backgroundColor: therrTheme.colors.brandingBlueGreen,
            alignItems: 'center',
        },
        bannerTitle: {
            display: 'flex',
            flexDirection: 'row',
            flex: 1,
            alignItems: 'center',
            marginLeft: 2,
        },
        bannerTitleText: {
            color: therrTheme.colors.brandingWhite,
            fontSize: 15,
            fontFamily: therrFontFamily,
            paddingRight: 8,
            flex: 1,
        },
        bannerTitleTextSmall: {
            color: therrTheme.colors.brandingWhite,
            fontSize: 11,
            fontFamily: therrFontFamily,
            paddingLeft: 3,
            flex: 1,
        },
        bannerTitleTextCenter: {
            color: therrTheme.colors.brandingWhite,
            fontSize: 15,
            fontFamily: therrFontFamily,
            textAlign: 'center',
        },
        bannerLinkText: {
            textDecorationLine: 'underline',
            color: therrTheme.colors.brandingWhite,
        },
        bannerTitleIcon: {
            color: therrTheme.colors.accentYellow,
            marginRight: 5,
            height: 28,
            width: 28,
        },
        // This container is important to keep the snap at the left side of each card
        cardContainer: {
            display: 'flex',
            flexDirection: 'column',
            padding: 0,
        },
        card: {
            ...getCardStyles(therrTheme),
        },
        cardFocused: {
            ...getCardStyles(therrTheme),
            borderColor: 'rgba(170,10,170, 0.15)',
            borderWidth: 2,
        },
        cardFeatured: {
            // borderColor: therrTheme.colors.brandingBlueGreen,
            // borderWidth: 2,
        },
        cardImageContainer: {
            flex: 1,
            width: '100%',
        },
        cardImage: {
            height: '100%',
            width: '100%',
        },
        textContent: {
            display: 'flex',
            justifyContent: 'flex-end',
        },
        cardTitle: {
            fontFamily: therrFontFamily,
            fontSize: 12,
            marginTop: 5,
            fontWeight: '600',
            color: therrTheme.colors.textWhite,
            paddingHorizontal: 8,
            paddingBottom: 4,
        },
        cardDescription: {
            fontFamily: therrFontFamily,
            fontSize: 11,
            color: therrTheme.colors.textWhite,
            paddingHorizontal: 8,
            paddingBottom: 3,
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
