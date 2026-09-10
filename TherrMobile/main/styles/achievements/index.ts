import { StyleSheet } from 'react-native';
import Color from 'color';
import { IMobileThemeName } from 'therr-react/types';
import { getTheme } from '../themes';
import { therrFontFamily } from '../font';
import { fontSizes, fontWeights, lineHeights } from '../text';
import { space } from '../layouts/spacing';
import { radius } from '../radii';
import { shadowSm } from '../elevation';
import { buttonMenuHeight } from '../navigation/buttonMenu';

// Progress meters used to be 18dp tall and absolutely positioned, which read as
// a chunky placeholder rather than a measured value. 8dp on a tinted track is
// the current cross-platform norm and leaves the numeric label to do the
// precise reporting.
const PROGRESS_BAR_HEIGHT = 8;

const tint = (color: string, alpha: number) => new Color(color).alpha(alpha).string();

const buildStyles = (themeName?: IMobileThemeName) => {
    const therrTheme = getTheme(themeName);

    const styles = StyleSheet.create({
        // ------------------------------------------------------------------
        // Screen scaffolding
        // ------------------------------------------------------------------
        // Clears the floating bottom nav, which previously overlapped the last
        // card in the list.
        listContentContainer: {
            paddingBottom: buttonMenuHeight + space.lg,
        },

        // Leaderboard entry point — a card with a contained icon rather than a
        // flat colored bar, so it reads as navigation, not as a banner.
        leaderboardLink: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginHorizontal: space.lg,
            marginTop: space.lg,
            marginBottom: space.sm,
            paddingVertical: space.md,
            paddingHorizontal: space.lg,
            borderRadius: radius.xl,
            backgroundColor: therrTheme.colors.brand,
            ...shadowSm,
        },
        leaderboardLinkPressed: {
            opacity: 0.85,
        },
        leaderboardLinkContent: {
            flexDirection: 'row',
            alignItems: 'center',
            flex: 1,
        },
        leaderboardIconContainer: {
            width: 32,
            height: 32,
            borderRadius: radius.circle,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: tint(therrTheme.colors.onBrand, 0.18),
            marginRight: space.md,
        },
        leaderboardLinkText: {
            fontFamily: therrFontFamily,
            fontSize: fontSizes.md,
            fontWeight: fontWeights.semibold,
            color: therrTheme.colors.onBrand,
            flexShrink: 1,
        },

        // Section headers — an uppercase overline separates structure from
        // content instead of competing with the card titles at the same size.
        sectionHeader: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: space.lg,
            paddingTop: space.xl,
            paddingBottom: space.sm,
        },
        sectionHeaderPressed: {
            opacity: 0.7,
        },
        sectionHeaderTitle: {
            fontFamily: therrFontFamily,
            fontSize: fontSizes.sm,
            fontWeight: fontWeights.bold,
            letterSpacing: 0.8,
            textTransform: 'uppercase',
            color: therrTheme.colors.onSurfaceMuted,
            flexShrink: 1,
        },
        sectionHeaderTrailing: {
            flexDirection: 'row',
            alignItems: 'center',
        },
        sectionHeaderCount: {
            fontFamily: therrFontFamily,
            fontSize: fontSizes.xs,
            fontWeight: fontWeights.semibold,
            color: therrTheme.colors.onSurfaceMuted,
            backgroundColor: therrTheme.colors.backgroundNeutral,
            overflow: 'hidden',
            borderRadius: radius.pill,
            paddingHorizontal: space.sm,
            paddingVertical: 2,
            marginRight: space.sm,
        },

        // ------------------------------------------------------------------
        // Achievement tile
        // ------------------------------------------------------------------
        achievementTile: {
            marginHorizontal: space.lg,
            marginBottom: space.md,
            padding: space.lg,
            borderRadius: radius.xl,
            backgroundColor: therrTheme.colors.surface,
            ...shadowSm,
        },
        achievementTilePressed: {
            opacity: 0.9,
        },
        achievementTileContainer: {
            flexDirection: 'row',
        },
        cardImageContainer: {
            width: 72,
            marginRight: space.lg,
        },
        cardImageContainerLarge: {
            width: '40%',
            paddingRight: 0,
        },
        cardImage: {
            height: 92,
            width: '100%',
            borderRadius: radius.lg,
            overflow: 'hidden',
            backgroundColor: therrTheme.colors.backgroundNeutral,
        },
        cardImageLarge: {
            display: 'flex',
            resizeMode: 'contain',
            height: 212,
            width: '100%',
        },
        tileTextContainer: {
            flex: 1,
            justifyContent: 'center',
        },
        // The achievement class was previously inlined into every title
        // ("Socialite: Friendly"), repeating the section heading on each row.
        // It is now a quiet overline and the title carries the row.
        achievementClassLabel: {
            fontFamily: therrFontFamily,
            fontSize: fontSizes.xs,
            fontWeight: fontWeights.bold,
            letterSpacing: 0.6,
            textTransform: 'uppercase',
            color: therrTheme.colors.brand,
            marginBottom: 2,
        },
        achievementTitle: {
            fontFamily: therrFontFamily,
            fontSize: fontSizes.lg,
            fontWeight: fontWeights.semibold,
            color: therrTheme.colors.onSurface,
        },
        achievementDescription: {
            fontFamily: therrFontFamily,
            fontSize: fontSizes.sm,
            lineHeight: fontSizes.sm * lineHeights.normal,
            color: therrTheme.colors.onSurfaceMuted,
            marginTop: 2,
        },

        // ------------------------------------------------------------------
        // Progress meter
        // ------------------------------------------------------------------
        progressRow: {
            flexDirection: 'row',
            alignItems: 'center',
            marginTop: space.md,
        },
        progressBarTrack: {
            flex: 1,
            height: PROGRESS_BAR_HEIGHT,
            borderRadius: radius.pill,
            backgroundColor: therrTheme.colors.backgroundNeutral,
            overflow: 'hidden',
        },
        progressBarFill: {
            height: '100%',
            borderRadius: radius.pill,
            backgroundColor: therrTheme.colors.brand,
        },
        progressBarFillComplete: {
            backgroundColor: therrTheme.colors.alertSuccess,
        },
        progressLabel: {
            fontFamily: therrFontFamily,
            fontSize: fontSizes.xs,
            fontWeight: fontWeights.semibold,
            color: therrTheme.colors.onSurfaceMuted,
            marginLeft: space.md,
            minWidth: 42,
            textAlign: 'right',
        },

        // ------------------------------------------------------------------
        // Completed / claim states
        // ------------------------------------------------------------------
        completedContainer: {
            marginTop: space.md,
        },
        // Tonal chip instead of a bare green sentence — carries an icon as well
        // as color so the completed state is not conveyed by hue alone.
        completedChip: {
            flexDirection: 'row',
            alignItems: 'center',
            alignSelf: 'flex-start',
            marginTop: space.md,
            paddingVertical: space.xs,
            paddingHorizontal: space.md,
            borderRadius: radius.pill,
            backgroundColor: tint(therrTheme.colors.alertSuccess, 0.14),
        },
        completeText: {
            fontFamily: therrFontFamily,
            fontSize: fontSizes.xs,
            fontWeight: fontWeights.semibold,
            color: therrTheme.colors.alertSuccess,
            marginLeft: space.xs,
        },
        claimButton: {
            flexDirection: 'row',
            width: '100%',
            minHeight: 44,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: therrTheme.colors.accent,
            borderRadius: radius.md,
            ...shadowSm,
        },
        claimButtonPressed: {
            opacity: 0.85,
        },
        claimText: {
            fontFamily: therrFontFamily,
            fontSize: fontSizes.md,
            fontWeight: fontWeights.semibold,
            color: therrTheme.colors.onAccent,
            marginLeft: space.sm,
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
