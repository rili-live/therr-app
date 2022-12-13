import { StyleSheet } from 'react-native';
import { IMobileThemeName } from 'therr-react/types';
import { therrFontFamily } from '../font';
import { getTheme, ITherrTheme } from '../themes';

const getSocialIndicatorBase: any = (therrTheme: ITherrTheme) => ({
    width: 6,
    height: 7,
    borderRadius: 4,
    backgroundColor: therrTheme.colors.backgroundNeutral,
});

const buildStyles = (themeName?: IMobileThemeName) => {
    const therrTheme = getTheme(themeName);

    const styles = StyleSheet.create({
        // Main
        container: {
            display: 'flex',
            flex: 1,
            flexDirection: 'column',
            alignItems: 'center',
        },
        profileInfoContainer: {
            display: 'flex',
            flexDirection: 'row',
            marginTop: 21,
        },
        profileImageContainer: {
            marginHorizontal: 17,
        },
        profileSummaryContainer: {
            flex: 1,
            paddingRight: 14,
        },
        connectionCountContainer: {
            display: 'flex',
            flexDirection: 'row',
            alignItems: 'center',
            marginTop: 8,
        },
        connectionCountIcon: {
            color: therrTheme.colors.textWhite,
            marginRight: 8,
        },
        connectionCountNumber: {
            color: therrTheme.colors.textWhite,
            marginRight: 4,
            fontWeight: '600',
            fontSize: 16,
        },
        connectionCountText: {
            fontFamily: therrFontFamily,
            color: therrTheme.colors.textWhite,
            fontSize: 14,
            fontWeight: '400',
        },
        profileFullName: {
            fontSize: 20,
            fontWeight: '600',
            marginBottom: 8,
        },
        profileBio: {
            fontSize: 14,
            fontWeight: '400',
        },
        socialLinksContainer: {
            display: 'flex',
            flexDirection: 'row',
            justifyContent: 'space-around',
            marginTop: 16,
            width: '100%',
        },
        socialIconPressable: {
            display: 'flex',
            flexDirection: 'row',
        },
        socialIcon: {
            marginRight: 7,
        },
        socialIconInstaContainer: {
            backgroundColor: 'transparent',
            justifyContent: 'center',
            alignItems: 'center',
        },
        socialIndicatorsContainer: {
            display: 'flex',
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            width: 30,
        },
        socialIndicatorOne: {
            ...getSocialIndicatorBase(therrTheme),
            height: 6,
        },
        socialIndicatorTwo: {
            ...getSocialIndicatorBase(therrTheme),
            height: 12,
        },
        socialIndicatorThree: {
            ...getSocialIndicatorBase(therrTheme),
            height: 18,
        },
        socialIndicatorFour: {
            ...getSocialIndicatorBase(therrTheme),
            height: 24,
        },

        // Action Menu
        actionsContainer: {
            display: 'flex',
            flexDirection: 'row',
            marginVertical: 24,
        },
        actionMenuContainer: {
            width: '100%',
            marginTop: 10,
        },
        actionMenuItemContainer: {
            display: 'flex',
            flexDirection: 'row',
            alignItems: 'center',
        },
        actionMenuItemIcon: {
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: 50,
            width: 50,
            marginHorizontal: 4,
        },
        actionMenuItemText: {
            color: therrTheme.colorVariations.accentTextWhiteFade,
            fontSize: 16,
            flex: 1,
            paddingRight: 10,
        },
        separator: {
            width: '94%',
            marginHorizontal: '3%',
            height: 2,
            backgroundColor: therrTheme.colorVariations.accent1Fade,
        },

        // Profile Picture
        profileImage: {
            width: 100,
            height: 100,
            borderRadius: 50,
        },

        // Content
        contentPostsContainer: {
            display: 'flex',
            flexDirection: 'row',
            flexWrap: 'wrap',
        },
        noPostsContainer: {
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            height: 300,
        },
        noPostsTexts: {
            fontSize: 20,
            paddingHorizontal: 24,
            textAlign: 'center',
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
