import { StyleSheet } from 'react-native';
import Color from 'color';
import { IMobileThemeName } from 'therr-react/types';
import { getTheme } from '../themes';
import { therrFontFamily } from '../font';
import { fontSizes, fontWeights, lineHeights } from '../text';
import { space } from '../layouts/spacing';
import { radius } from '../radii';
import { shadowMd, shadowSm } from '../elevation';
import { buttonMenuHeight } from '../navigation/buttonMenu';

// Progress meters used to be 18dp tall and absolutely positioned, which read as
// a chunky placeholder rather than a measured value. 8dp on a tinted track is
// the current cross-platform norm and leaves the numeric label to do the
// precise reporting.
const PROGRESS_BAR_HEIGHT = 8;

// Grid geometry. Exported because the grid sizes its cards from the same numbers
// the panel is laid out with — see `getBadgeGridCardWidth`.
export const GRID_PANEL_PADDING = 8;
export const GRID_GAP = 8;

// 132dp detail badge × the badge's 12/72 corner ratio.
const DETAIL_BADGE_RADIUS = 22;
// Nine of these and their links fit a 360dp phone's 312dp content width.
const LADDER_STEP_SIZE = 28;

const tint = (color: string, alpha: number) => new Color(color).alpha(alpha).string();
const mix = (from: string, to: string, share: number) => new Color(from).mix(new Color(to), share).hex();

/**
 * A fill colour as text. The brand gold as 11sp type on a light surface sits near
 * 2.6:1, and the brand purple on the dark theme's surface is no better, so each is
 * stepped toward the surface's own text colour until it clears 4.5:1. A colour that
 * already does is returned as is.
 */
const readableOn = (fill: string, surface: string, onSurface: string) => {
    let color = new Color(fill);
    const surfaceColor = new Color(surface);
    const target = new Color(onSurface);
    for (let step = 0; step < 10 && color.contrast(surfaceColor) < 4.5; step += 1) {
        color = color.mix(target, 0.12);
    }
    return color.hex();
};

const buildStyles = (themeName?: IMobileThemeName) => {
    const therrTheme = getTheme(themeName);
    const accentText = readableOn(therrTheme.colors.accent, therrTheme.colors.surface, therrTheme.colors.onSurface);
    const brandText = readableOn(therrTheme.colors.brand, therrTheme.colors.surface, therrTheme.colors.onSurface);

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

        // Habit companion — the growing pixel chameleon. A surface card like the
        // achievement tiles, with the sprite in a tinted well so the pixel art has
        // a consistent backdrop in light and dark themes.
        companionCard: {
            flexDirection: 'row',
            alignItems: 'center',
            marginHorizontal: space.lg,
            marginTop: space.lg,
            padding: space.lg,
            borderRadius: radius.xl,
            backgroundColor: therrTheme.colors.surface,
            ...shadowSm,
        },
        companionSpriteWell: {
            alignItems: 'center',
            justifyContent: 'center',
            padding: space.sm,
            borderRadius: radius.lg,
            backgroundColor: tint(therrTheme.colors.brand, 0.10),
            marginRight: space.lg,
        },
        companionTextContainer: {
            flex: 1,
        },
        companionStageOf: {
            fontFamily: therrFontFamily,
            fontSize: fontSizes.xs,
            color: therrTheme.colors.onSurfaceMuted,
            marginTop: 2,
        },
        companionRequirement: {
            fontFamily: therrFontFamily,
            fontSize: fontSizes.xs,
            color: therrTheme.colors.onSurfaceMuted,
            marginTop: 2,
        },
        companionRequirementMet: {
            color: therrTheme.colors.alertSuccess,
            fontWeight: fontWeights.semibold,
        },
        companionProgressRow: {
            marginTop: space.sm,
            marginBottom: 2,
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
            marginLeft: space.sm,
        },
        sectionHeaderCountAccent: {
            color: accentText,
            backgroundColor: tint(therrTheme.colors.accent, 0.16),
        },

        // ------------------------------------------------------------------
        // Achievement row — "ready to claim" and "up next"
        // ------------------------------------------------------------------
        // The row used to be 130dp tall with the claim button on a line of its
        // own. It now holds the badge, the copy and the action on one line, so
        // three of them fit where one and a half did.
        achievementTile: {
            flexDirection: 'row',
            alignItems: 'center',
            marginHorizontal: space.lg,
            marginBottom: space.sm,
            padding: space.md,
            borderRadius: radius.xl,
            backgroundColor: therrTheme.colors.surface,
            ...shadowSm,
        },
        // A reward waiting is the one row on the screen that pays out; a gold
        // keyline and wash mark it without resorting to a second card style.
        achievementTileClaimable: {
            borderWidth: 1,
            borderColor: tint(therrTheme.colors.accent, 0.5),
            backgroundColor: mix(therrTheme.colors.accent, therrTheme.colors.surface, 0.94),
        },
        achievementTilePressed: {
            opacity: 0.9,
        },
        tileTextContainer: {
            flex: 1,
            justifyContent: 'center',
            marginLeft: space.md,
        },
        tileOverlineRow: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
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
            color: brandText,
            flexShrink: 1,
            marginBottom: 2,
        },
        // What the achievement is worth, up front: the reward is the reason to
        // finish it, and it used to be two taps away.
        rewardHint: {
            flexDirection: 'row',
            alignItems: 'center',
            marginLeft: space.sm,
            marginBottom: 2,
        },
        rewardHintText: {
            fontFamily: therrFontFamily,
            fontSize: fontSizes.xs,
            fontWeight: fontWeights.semibold,
            color: therrTheme.colors.onSurfaceMuted,
            marginLeft: space.xs,
        },
        // Also the habit companion card's stage name.
        achievementTitle: {
            fontFamily: therrFontFamily,
            fontSize: fontSizes.lg,
            fontWeight: fontWeights.semibold,
            color: therrTheme.colors.onSurface,
        },
        tileTitle: {
            fontFamily: therrFontFamily,
            fontSize: fontSizes.md,
            lineHeight: fontSizes.md * 1.25,
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
            marginTop: space.sm,
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
        // Tonal chip instead of a bare green sentence — carries an icon as well
        // as color so the completed state is not conveyed by hue alone.
        completedChip: {
            flexDirection: 'row',
            alignItems: 'center',
            alignSelf: 'flex-start',
            marginTop: space.sm,
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
        // A pill at the end of the row rather than a full-width bar under it.
        // 40dp tall with an 8dp hit slop clears the 44dp touch-target floor.
        claimButton: {
            flexDirection: 'row',
            minHeight: 40,
            alignItems: 'center',
            justifyContent: 'center',
            marginLeft: space.md,
            paddingHorizontal: space.lg,
            backgroundColor: therrTheme.colors.accent,
            borderRadius: radius.pill,
            ...shadowSm,
        },
        claimButtonPressed: {
            opacity: 0.85,
        },
        claimText: {
            fontFamily: therrFontFamily,
            fontSize: fontSizes.sm,
            fontWeight: fontWeights.semibold,
            color: therrTheme.colors.onAccent,
            marginLeft: space.sm,
        },

        // ------------------------------------------------------------------
        // Collection — the badge grid, one panel per ladder
        // ------------------------------------------------------------------
        collectionHeader: {
            paddingHorizontal: space.lg,
            paddingTop: space.xl,
            paddingBottom: space.xs,
        },
        collectionHeaderRow: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
        },
        collectionHeaderCount: {
            fontFamily: therrFontFamily,
            fontSize: fontSizes.xs,
            fontWeight: fontWeights.semibold,
            color: therrTheme.colors.onSurfaceMuted,
            marginLeft: space.md,
        },
        collectionProgressTrack: {
            height: 6,
            marginTop: space.sm,
            borderRadius: radius.pill,
            backgroundColor: therrTheme.colors.backgroundNeutral,
            overflow: 'hidden',
        },
        collectionProgressFill: {
            height: '100%',
            borderRadius: radius.pill,
            backgroundColor: therrTheme.colors.brand,
        },
        // The panels are flat where the rows above are raised: elevation is kept
        // for what the user can act on now, and a header and its grid rows are
        // separate list items, which a shadow could not span anyway.
        classHeader: {
            flexDirection: 'row',
            alignItems: 'center',
            minHeight: 52,
            marginHorizontal: space.lg,
            marginTop: space.md,
            paddingHorizontal: space.md,
            backgroundColor: therrTheme.colors.surface,
            borderTopLeftRadius: radius.xl,
            borderTopRightRadius: radius.xl,
        },
        classHeaderCollapsed: {
            borderBottomLeftRadius: radius.xl,
            borderBottomRightRadius: radius.xl,
        },
        classHeaderIcon: {
            width: 28,
            height: 28,
            borderRadius: radius.circle,
            alignItems: 'center',
            justifyContent: 'center',
            marginRight: space.md,
        },
        classHeaderTitle: {
            flex: 1,
            fontFamily: therrFontFamily,
            fontSize: fontSizes.md,
            fontWeight: fontWeights.semibold,
            color: therrTheme.colors.onSurface,
        },
        classHeaderCount: {
            flexDirection: 'row',
            alignItems: 'center',
            marginHorizontal: space.sm,
            paddingHorizontal: space.sm,
            paddingVertical: 2,
            borderRadius: radius.pill,
            backgroundColor: therrTheme.colors.backgroundNeutral,
        },
        classHeaderCountComplete: {
            backgroundColor: tint(therrTheme.colors.alertSuccess, 0.14),
        },
        classHeaderCountText: {
            fontFamily: therrFontFamily,
            fontSize: fontSizes.xs,
            fontWeight: fontWeights.semibold,
            color: therrTheme.colors.onSurfaceMuted,
        },
        classHeaderCountTextComplete: {
            color: therrTheme.colors.alertSuccess,
            marginLeft: space.xs,
        },
        classPanelRow: {
            marginHorizontal: space.lg,
            paddingHorizontal: GRID_PANEL_PADDING,
            paddingTop: space.xs,
            paddingBottom: space.md,
            backgroundColor: therrTheme.colors.surface,
        },
        classPanelRowLast: {
            paddingBottom: space.lg,
            borderBottomLeftRadius: radius.xl,
            borderBottomRightRadius: radius.xl,
        },
        badgeRow: {
            flexDirection: 'row',
            alignItems: 'flex-start',
            columnGap: GRID_GAP,
        },
        badgeCell: {
            flex: 1,
            alignItems: 'center',
        },
        badgeCellPressed: {
            opacity: 0.7,
        },
        badgeCellArt: {
            alignItems: 'center',
            justifyContent: 'center',
        },
        // "There is a reward on this one" — sits on the card's corner the way a
        // notification dot sits on an icon, ringed in the surface colour so it
        // reads as on top of the card rather than part of its art.
        badgeCellGift: {
            position: 'absolute',
            top: -6,
            right: -6,
            width: 22,
            height: 22,
            borderRadius: radius.circle,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: therrTheme.colors.accent,
            borderWidth: 2,
            borderColor: therrTheme.colors.surface,
        },
        badgeCellTitle: {
            fontFamily: therrFontFamily,
            fontSize: 13,
            lineHeight: 17,
            fontWeight: fontWeights.semibold,
            color: therrTheme.colors.onSurface,
            textAlign: 'center',
            marginTop: space.sm,
        },
        badgeCellTitleLocked: {
            fontWeight: fontWeights.regular,
            color: therrTheme.colors.onSurfaceMuted,
        },
        badgeCellProgress: {
            alignItems: 'center',
            marginTop: 6,
        },
        badgeCellProgressTrack: {
            alignSelf: 'stretch',
            height: 4,
            borderRadius: radius.pill,
            backgroundColor: therrTheme.colors.backgroundNeutral,
            overflow: 'hidden',
        },
        badgeCellMeta: {
            fontFamily: therrFontFamily,
            fontSize: 11,
            lineHeight: 14,
            fontWeight: fontWeights.semibold,
            color: therrTheme.colors.onSurfaceMuted,
            marginTop: 3,
        },
        badgeCellMetaClaim: {
            color: accentText,
        },
        // The cell that stands in for a ladder's hidden locked badges. Same
        // footprint as a card, drawn as an empty slot so it reads as "more of
        // these" rather than as another badge.
        badgeMoreCard: {
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: radius.lg,
            borderWidth: 1.5,
            borderStyle: 'dashed',
            borderColor: tint(therrTheme.colors.onSurface, 0.22),
        },
        badgeMoreCount: {
            fontFamily: therrFontFamily,
            fontSize: fontSizes.xl,
            fontWeight: fontWeights.semibold,
            color: therrTheme.colors.onSurfaceMuted,
        },
        badgeMoreLabel: {
            color: brandText,
        },

        // ------------------------------------------------------------------
        // Profile showcase — earned badges, then what is in progress
        // ------------------------------------------------------------------
        showcaseHeader: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: space.lg,
            paddingTop: space.lg,
            paddingBottom: space.md,
        },
        showcaseHeaderFirst: {
            paddingTop: space.sm,
        },
        showcaseLink: {
            flexDirection: 'row',
            alignItems: 'center',
            minHeight: 32,
            marginLeft: space.md,
        },
        showcaseLinkText: {
            fontFamily: therrFontFamily,
            fontSize: fontSizes.sm,
            fontWeight: fontWeights.semibold,
            color: brandText,
            marginRight: space.xs,
        },
        showcaseRow: {
            paddingHorizontal: space.lg + GRID_PANEL_PADDING,
            paddingBottom: space.lg,
        },

        // ------------------------------------------------------------------
        // Badge detail
        // ------------------------------------------------------------------
        detailContainer: {
            alignItems: 'center',
            paddingHorizontal: space.xl,
            paddingBottom: buttonMenuHeight + space.xl,
        },
        detailHero: {
            width: '100%',
            height: 248,
            alignItems: 'center',
            justifyContent: 'center',
        },
        detailHalo: {
            position: 'absolute',
            width: 216,
            height: 216,
            borderRadius: radius.circle,
            opacity: 0.12,
        },
        detailHaloLocked: {
            opacity: 0.6,
        },
        detailConfetti: {
            position: 'absolute',
            width: '100%',
            height: '100%',
        },
        // The frame, not the art, carries the shadow: the art clips its own
        // corners, and a clipped view casts no elevation on Android.
        detailBadgeFrame: {
            borderRadius: DETAIL_BADGE_RADIUS,
            backgroundColor: therrTheme.colors.surface,
        },
        detailBadgeFrameEarned: {
            ...shadowMd,
        },
        detailOverline: {
            fontFamily: therrFontFamily,
            fontSize: fontSizes.xs,
            fontWeight: fontWeights.bold,
            letterSpacing: 0.8,
            textTransform: 'uppercase',
            color: brandText,
            textAlign: 'center',
        },
        detailTitle: {
            fontFamily: therrFontFamily,
            fontSize: fontSizes.xxl,
            lineHeight: fontSizes.xxl * lineHeights.tight,
            fontWeight: fontWeights.semibold,
            color: therrTheme.colors.onSurface,
            textAlign: 'center',
            marginTop: space.xs,
        },
        detailDescription: {
            fontFamily: therrFontFamily,
            fontSize: fontSizes.md,
            lineHeight: fontSizes.md * lineHeights.normal,
            color: therrTheme.colors.onSurfaceMuted,
            textAlign: 'center',
            marginTop: space.sm,
        },
        detailNote: {
            fontFamily: therrFontFamily,
            fontSize: fontSizes.sm,
            lineHeight: fontSizes.sm * lineHeights.normal,
            color: therrTheme.colors.onSurfaceMuted,
            textAlign: 'center',
            marginTop: space.md,
        },
        detailProgress: {
            alignSelf: 'stretch',
            marginTop: space.xl,
        },
        detailProgressLabels: {
            flexDirection: 'row',
            alignItems: 'baseline',
            justifyContent: 'space-between',
            marginBottom: space.sm,
        },
        detailProgressCount: {
            fontFamily: therrFontFamily,
            fontSize: fontSizes.md,
            fontWeight: fontWeights.semibold,
            color: therrTheme.colors.onSurface,
        },
        detailProgressRemaining: {
            fontFamily: therrFontFamily,
            fontSize: fontSizes.sm,
            color: therrTheme.colors.onSurfaceMuted,
        },
        detailProgressTrack: {
            height: 10,
            borderRadius: radius.pill,
            backgroundColor: therrTheme.colors.backgroundNeutral,
            overflow: 'hidden',
        },
        detailProgressFill: {
            height: '100%',
            borderRadius: radius.pill,
        },
        detailStatusChip: {
            flexDirection: 'row',
            alignItems: 'center',
            marginTop: space.lg,
            paddingVertical: 6,
            paddingHorizontal: space.md,
            borderRadius: radius.pill,
            backgroundColor: therrTheme.colors.backgroundNeutral,
        },
        detailStatusChipEarned: {
            backgroundColor: tint(therrTheme.colors.alertSuccess, 0.14),
        },
        detailStatusText: {
            fontFamily: therrFontFamily,
            fontSize: fontSizes.sm,
            fontWeight: fontWeights.semibold,
            color: therrTheme.colors.onSurfaceMuted,
            marginLeft: 6,
        },
        detailStatusTextEarned: {
            color: therrTheme.colors.alertSuccess,
        },
        detailRewards: {
            alignSelf: 'stretch',
            marginTop: space.xl,
            padding: space.lg,
            borderRadius: radius.xl,
            backgroundColor: therrTheme.colors.surfaceAlt,
        },
        detailRewardsLabel: {
            fontFamily: therrFontFamily,
            fontSize: fontSizes.xs,
            fontWeight: fontWeights.bold,
            letterSpacing: 0.8,
            textTransform: 'uppercase',
            color: therrTheme.colors.onSurfaceMuted,
        },
        detailRewardsRow: {
            flexDirection: 'row',
            alignItems: 'center',
            marginTop: space.md,
        },
        detailReward: {
            flex: 1,
            flexDirection: 'row',
            alignItems: 'center',
        },
        detailRewardDivider: {
            width: StyleSheet.hairlineWidth,
            alignSelf: 'stretch',
            marginHorizontal: space.md,
            backgroundColor: tint(therrTheme.colors.onSurface, 0.16),
        },
        detailRewardIcon: {
            width: 36,
            height: 36,
            borderRadius: radius.circle,
            alignItems: 'center',
            justifyContent: 'center',
            marginRight: space.md,
        },
        detailRewardIconCoins: {
            backgroundColor: tint(therrTheme.colors.accent, 0.16),
        },
        detailRewardIconXp: {
            backgroundColor: tint(therrTheme.colors.brand, 0.14),
        },
        detailRewardValue: {
            fontFamily: therrFontFamily,
            fontSize: fontSizes.xl,
            lineHeight: fontSizes.xl * lineHeights.tight,
            fontWeight: fontWeights.semibold,
            color: therrTheme.colors.onSurface,
        },
        detailRewardUnit: {
            fontFamily: therrFontFamily,
            fontSize: fontSizes.xs,
            color: therrTheme.colors.onSurfaceMuted,
        },
        detailClaimButton: {
            flexDirection: 'row',
            alignSelf: 'stretch',
            minHeight: 48,
            alignItems: 'center',
            justifyContent: 'center',
            marginTop: space.lg,
            borderRadius: radius.pill,
            backgroundColor: therrTheme.colors.accent,
            ...shadowSm,
        },
        detailClaimText: {
            fontFamily: therrFontFamily,
            fontSize: fontSizes.md,
            fontWeight: fontWeights.semibold,
            color: therrTheme.colors.onAccent,
            marginLeft: space.sm,
        },
        // The ladder the badge sits on: one node per level, joined so the eye
        // reads it as a path. Tapping a node shows that level in place.
        detailLadder: {
            alignSelf: 'stretch',
            marginTop: space.xl,
        },
        detailLadderRow: {
            flexDirection: 'row',
            alignItems: 'center',
            marginTop: space.md,
        },
        detailLadderLink: {
            flex: 1,
            height: 2,
            minWidth: 4,
            backgroundColor: therrTheme.colors.backgroundNeutral,
        },
        detailLadderStep: {
            width: LADDER_STEP_SIZE,
            height: LADDER_STEP_SIZE,
            borderRadius: radius.circle,
            borderWidth: 2,
            alignItems: 'center',
            justifyContent: 'center',
        },
        detailLadderStepSelected: {
            transform: [{ scale: 1.14 }],
        },
        detailLadderStepText: {
            fontFamily: therrFontFamily,
            fontSize: 11,
            lineHeight: 14,
            fontWeight: fontWeights.bold,
            textAlign: 'center',
            includeFontPadding: false,
        },
    });

    return ({
        ...therrTheme,
        // Brand and accent as text colours, for icons that sit beside that text.
        textColors: { accent: accentText, brand: brandText },
        styles,
    });
};

export {
    buildStyles,
};
