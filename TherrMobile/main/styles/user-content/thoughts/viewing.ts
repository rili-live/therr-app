import { StyleSheet } from 'react-native';
import { IMobileThemeName } from 'therr-react/types';
import { getTheme } from '../../themes';
import { therrFontFamily } from '../../font';

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
        inspectThoughtContainer: {
            justifyContent: 'flex-start',
            alignItems: 'stretch',
            padding: 0,
            paddingHorizontal: 0,
            marginTop: 0,
        },
        thoughtCard: {
            marginBottom: 4,
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
        // Repost attribution line ("<user> reposted"), rendered above the card's own author row.
        repostAttributionContainer: {
            display: 'flex',
            flexDirection: 'row',
            alignItems: 'center',
            paddingLeft: 6,
            paddingBottom: 2,
        },
        repostAttributionText: {
            fontSize: 12,
            fontWeight: '600',
            paddingLeft: 6,
            color: isDarkMode ? therrTheme.colorVariations.accentTextWhiteFade : therrTheme.colors.textGray,
        },
        // The embedded original inside a repost. Boxed rather than left-bordered (which is how
        // a thread preview reads) so the two never look like the same relationship: a reply
        // continues the post above it, an embed is a different post being quoted.
        repostEmbedContainer: {
            marginTop: 6,
            marginBottom: 2,
            marginRight: 12,
            padding: 10,
            borderWidth: 1,
            borderRadius: 10,
            borderColor: isDarkMode ? therrTheme.colors.accentDivider : therrTheme.colorVariations.backgroundNeutral,
        },
        repostEmbedHeader: {
            display: 'flex',
            flexDirection: 'row',
            alignItems: 'center',
            paddingBottom: 4,
        },
        repostEmbedAvatarImg: {
            height: 22,
            width: 22,
            borderRadius: 11,
        },
        repostEmbedUserName: {
            fontSize: 13,
            fontWeight: '600',
            paddingLeft: 6,
            color: isDarkMode ? therrTheme.colors.accentTextWhite : therrTheme.colors.tertiary,
        },
        repostEmbedDateTime: {
            fontSize: 11,
            paddingLeft: 6,
            color: isDarkMode ? therrTheme.colorVariations.accentTextWhiteFade : therrTheme.colors.textGray,
        },
        repostEmbedMessage: {
            fontSize: 14,
            color: isDarkMode ? therrTheme.colors.accentTextWhite : therrTheme.colors.tertiary,
        },
        // Shown in place of the embed when the original is gone, out of brand, or hidden.
        repostEmbedUnavailableText: {
            fontSize: 13,
            fontStyle: 'italic',
            color: isDarkMode ? therrTheme.colorVariations.accentTextWhiteFade : therrTheme.colors.textGray,
        },
        threadPreviewContainer: {
            display: 'flex',
            flexDirection: 'row',
            marginLeft: thoughtUserAvatarImgWidth + (2 * thoughtUserAvatarImgPadding),
            marginTop: 2,
            marginBottom: 6,
            paddingLeft: 8,
            paddingRight: 4,
            borderLeftWidth: 2,
            borderLeftColor: isDarkMode ? therrTheme.colors.accentDivider : therrTheme.colorVariations.backgroundNeutral,
        },
        threadPreviewAvatarImgContainer: {
            width: 32,
            display: 'flex',
            justifyContent: 'flex-start',
            alignItems: 'center',
            paddingTop: 2,
        },
        threadPreviewAvatarImg: {
            height: 28,
            width: 28,
            borderRadius: 14,
        },
        threadPreviewContentContainer: {
            flex: 1,
            paddingLeft: 6,
        },
        threadPreviewUserName: {
            fontSize: 13,
            fontWeight: '600',
            paddingBottom: 1,
            color: isDarkMode ? therrTheme.colors.accentTextWhite : therrTheme.colors.tertiary,
        },
        threadPreviewMessage: {
            fontSize: 14,
            color: isDarkMode ? therrTheme.colors.accentTextWhite : therrTheme.colors.tertiary,
        },
        threadPreviewViewAllText: {
            fontSize: 13,
            fontWeight: '600',
            paddingTop: 4,
            color: therrTheme.colors.brand,
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
            fontFamily: therrFontFamily,
            textAlign: 'left',
        },
        footer: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            paddingHorizontal: 16,
            paddingTop: 12,
            paddingBottom: 24,
            borderTopWidth: StyleSheet.hairlineWidth,
            borderTopColor: isDarkMode ? therrTheme.colors.accentDivider : therrTheme.colors.tertiary,
            backgroundColor: therrTheme.colors.primary,
        },
        replyInputContainer: {
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: 12,
            paddingVertical: 8,
            borderTopWidth: StyleSheet.hairlineWidth,
            borderTopColor: isDarkMode ? therrTheme.colors.accentDivider : therrTheme.colors.tertiary,
            backgroundColor: therrTheme.colors.accent1,
        },
        // "This post is a reply" banner, rendered above the post in the details view. Styled as a
        // quoted block (left rule + muted text) so it reads as context rather than as the post.
        parentThoughtContainer: {
            flexDirection: 'row',
            alignItems: 'center',
            marginBottom: 10,
            marginHorizontal: 2,
            paddingVertical: 8,
            paddingHorizontal: 10,
            borderRadius: 8,
            backgroundColor: isDarkMode ? therrTheme.colors.accent1 : therrTheme.colorVariations.backgroundNeutral,
        },
        parentThoughtTextContainer: {
            flex: 1,
            paddingHorizontal: 8,
        },
        parentThoughtLabel: {
            fontSize: 12,
            fontWeight: '600',
            paddingBottom: 2,
            color: therrTheme.colors.brand,
        },
        parentThoughtMessage: {
            fontSize: 14,
            color: isDarkMode ? therrTheme.colorVariations.accentTextWhiteFade : therrTheme.colors.tertiary,
        },
        repliesDivider: {
            width: '100%',
            marginVertical: 12,
        },
        repliesHeader: {
            width: '100%',
            paddingHorizontal: 4,
            paddingBottom: 8,
            color: isDarkMode ? therrTheme.colors.accentTextWhite : therrTheme.colors.tertiary,
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
