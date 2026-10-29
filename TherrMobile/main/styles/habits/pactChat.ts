import { StyleSheet } from 'react-native';
import Color from 'color';
import { IMobileThemeName } from 'therr-react/types';
import { therrFontFamily } from '../font';
import { space } from '../layouts/spacing';
import { radius } from '../radii';
import { getTheme } from '../themes';
import { BRAND_WHITE } from '../themes/brandConstants';

const tint = (color: string, alpha: number) => new Color(color).alpha(alpha).string();

/**
 * Pact chat (routes/Pacts/PactChat.tsx). The bubbles and the composer reuse the direct-message
 * styles (styles/user-content/messages) so the two conversations look like one app; these are
 * only the parts a DM does not have — check-ins inline, reactions, quick replies, the mute bar.
 */
const buildStyles = (themeName?: IMobileThemeName) => {
    const therrTheme = getTheme(themeName);
    const { colors } = therrTheme;

    const styles = StyleSheet.create({
        topBar: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: space.md,
            paddingVertical: space.sm,
        },
        topBarText: {
            fontFamily: therrFontFamily,
            fontSize: 13,
            color: colors.textGray,
            flexShrink: 1,
        },
        mutePill: {
            flexDirection: 'row',
            alignItems: 'center',
            paddingVertical: space.xs,
            paddingHorizontal: space.md,
            borderRadius: radius.pill,
            borderWidth: 1,
            borderColor: colors.accentDivider,
        },
        mutePillText: {
            fontFamily: therrFontFamily,
            fontSize: 13,
            fontWeight: '600',
            color: colors.onSurface,
            marginLeft: space.xs,
        },
        authorName: {
            fontFamily: therrFontFamily,
            fontSize: 12,
            fontWeight: '600',
            color: colors.textGray,
            marginLeft: '3%',
            marginBottom: 2,
            marginTop: space.sm,
        },
        authorNameRight: {
            alignSelf: 'flex-end',
            marginLeft: 0,
            marginRight: '3%',
        },
        checkinCard: {
            alignSelf: 'center',
            maxWidth: '86%',
            marginVertical: space.sm,
            paddingVertical: space.sm,
            paddingHorizontal: space.md,
            borderRadius: radius.lg,
            backgroundColor: tint(colors.brand, 0.1),
            borderWidth: 1,
            borderColor: tint(colors.brand, 0.3),
        },
        checkinTitle: {
            fontFamily: therrFontFamily,
            fontSize: 14,
            fontWeight: '600',
            color: colors.onSurface,
            textAlign: 'center',
        },
        checkinNotes: {
            fontFamily: therrFontFamily,
            fontSize: 14,
            color: colors.onSurface,
            textAlign: 'center',
            marginTop: space.xs,
        },
        checkinMeta: {
            fontFamily: therrFontFamily,
            fontSize: 12,
            color: colors.textGray,
            textAlign: 'center',
            marginTop: space.xs,
        },
        reactionRow: {
            flexDirection: 'row',
            flexWrap: 'wrap',
            marginTop: -2,
            marginBottom: space.xs,
        },
        reactionRowLeft: {
            alignSelf: 'flex-start',
            marginLeft: '3%',
        },
        reactionRowRight: {
            alignSelf: 'flex-end',
            marginRight: '3%',
        },
        reactionRowCenter: {
            alignSelf: 'center',
        },
        reactionChip: {
            flexDirection: 'row',
            alignItems: 'center',
            paddingVertical: 2,
            paddingHorizontal: space.sm,
            borderRadius: radius.pill,
            borderWidth: 1,
            borderColor: colors.accentDivider,
            backgroundColor: colors.surface,
            marginRight: space.xs,
            marginTop: space.xs,
        },
        reactionChipMine: {
            borderColor: colors.brand,
            backgroundColor: tint(colors.brand, 0.12),
        },
        reactionChipText: {
            fontFamily: therrFontFamily,
            fontSize: 13,
            color: colors.onSurface,
        },
        pickerRow: {
            flexDirection: 'row',
            flexWrap: 'wrap',
            alignItems: 'center',
            alignSelf: 'center',
            paddingVertical: space.xs,
            paddingHorizontal: space.sm,
            marginBottom: space.sm,
            borderRadius: radius.pill,
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.accentDivider,
        },
        pickerEmoji: {
            fontSize: 24,
            paddingHorizontal: space.xs,
        },
        pickerEmojiSelected: {
            backgroundColor: tint(colors.brand, 0.16),
            borderRadius: radius.pill,
        },
        pickerAction: {
            fontFamily: therrFontFamily,
            fontSize: 13,
            fontWeight: '600',
            color: colors.primary3,
            paddingHorizontal: space.sm,
            paddingVertical: space.xs,
        },
        failedText: {
            fontFamily: therrFontFamily,
            fontSize: 12,
            color: colors.accentRed,
            alignSelf: 'flex-end',
            marginRight: '3%',
            marginBottom: space.xs,
        },
        quickReplyRow: {
            flexDirection: 'row',
            paddingHorizontal: space.sm,
            paddingTop: space.sm,
        },
        quickReplyChip: {
            paddingVertical: space.xs + 2,
            paddingHorizontal: space.md,
            borderRadius: radius.pill,
            borderWidth: 1,
            borderColor: tint(colors.brand, 0.5),
            marginRight: space.sm,
        },
        quickReplyText: {
            fontFamily: therrFontFamily,
            fontSize: 14,
            color: colors.onSurface,
        },
        readOnlyBanner: {
            paddingVertical: space.md,
            paddingHorizontal: space.lg,
            alignItems: 'center',
        },
        readOnlyText: {
            fontFamily: therrFontFamily,
            fontSize: 14,
            color: colors.textGray,
            textAlign: 'center',
        },
        emptyState: {
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
            paddingHorizontal: space.xl,
            // The list is inverted, so its empty component renders upside down unless flipped back.
            transform: [{ scaleY: -1 }],
        },
        emptyTitle: {
            fontFamily: therrFontFamily,
            fontSize: 18,
            fontWeight: '600',
            color: colors.onSurface,
            textAlign: 'center',
        },
        emptySubtitle: {
            fontFamily: therrFontFamily,
            fontSize: 14,
            color: colors.textGray,
            textAlign: 'center',
            marginTop: space.sm,
        },
        centered: {
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
            padding: space.xl,
        },
        retryText: {
            fontFamily: therrFontFamily,
            fontSize: 15,
            fontWeight: '600',
            color: colors.primary3,
            marginTop: space.md,
        },
        // The chat entry on the pact screen, and the unread badge it and the pact card share.
        entryRow: {
            flexDirection: 'row',
            alignItems: 'center',
        },
        entryTextContainer: {
            flex: 1,
            marginLeft: space.md,
        },
        entrySubtitle: {
            fontFamily: therrFontFamily,
            fontSize: 13,
            color: colors.textGray,
            marginTop: 2,
        },
        unreadBadge: {
            minWidth: 22,
            height: 22,
            paddingHorizontal: 6,
            borderRadius: 11,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: colors.brand,
            marginLeft: space.sm,
        },
        unreadBadgeText: {
            fontFamily: therrFontFamily,
            fontSize: 12,
            fontWeight: '700',
            color: BRAND_WHITE,
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
