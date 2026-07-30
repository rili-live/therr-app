import { StyleSheet } from 'react-native';
import Color from 'color';
import { IMobileThemeName } from 'therr-react/types';
import { getTheme, ITherrTheme } from '../themes';
import { therrFontFamily } from '../font';
import { fontSizes, fontWeights, lineHeights } from '../text';
import { space } from '../layouts/spacing';
import { radius } from '../radii';
import { shadowSm } from '../elevation';
import { buttonMenuHeight } from '../navigation/buttonMenu';

// Width of the colored rail down the left edge of an unread row. Unread state
// is carried by three signals at once — the rail, a tinted surface and a dot —
// because the previous single signal (a near-white background tint) was
// invisible in the light theme, and color alone is not an accessible cue.
const UNREAD_RAIL_WIDTH = 3;
const ICON_SIZE = 40;

// A 44dp square is the smallest comfortable touch target on both platforms
// (iOS HIG 44pt / Material 48dp with the surrounding row padding).
export const READ_TOGGLE_HIT_SIZE = 44;
export const NOTIFICATION_ICON_SIZE = ICON_SIZE;

const tint = (color: string, alpha: number) => new Color(color).alpha(alpha).string();

const getRowStyle = (theme: ITherrTheme): any => ({
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: space.lg,
    paddingRight: space.md,
    paddingLeft: space.lg,
    borderLeftWidth: UNREAD_RAIL_WIDTH,
    borderLeftColor: 'transparent',
    backgroundColor: theme.colors.surface,
});

const notifications = StyleSheet.create({
    // Clears the floating bottom nav, which previously overlapped the last row.
    flashListContentContainer: {
        paddingBottom: buttonMenuHeight + space.lg,
    },
});

const buildStyles = (themeName?: IMobileThemeName) => {
    const therrTheme = getTheme(themeName);

    const styles = StyleSheet.create({
        // ------------------------------------------------------------------
        // List header
        // ------------------------------------------------------------------
        listHeader: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: space.lg,
            paddingTop: space.lg,
            paddingBottom: space.md,
        },
        listHeaderTitle: {
            fontFamily: therrFontFamily,
            fontSize: fontSizes.sm,
            fontWeight: fontWeights.bold,
            letterSpacing: 0.8,
            textTransform: 'uppercase',
            color: therrTheme.colors.onSurfaceMuted,
        },
        // A tonal chip rather than a bare text link — it reads as an action and
        // gives the tap target real bounds.
        markAllReadButton: {
            flexDirection: 'row',
            alignItems: 'center',
            minHeight: 36,
            paddingHorizontal: space.md,
            borderRadius: radius.pill,
            backgroundColor: tint(therrTheme.colors.brand, 0.12),
        },
        markAllReadButtonPressed: {
            backgroundColor: tint(therrTheme.colors.brand, 0.22),
        },
        markAllReadText: {
            fontFamily: therrFontFamily,
            fontSize: fontSizes.sm,
            fontWeight: fontWeights.semibold,
            color: therrTheme.colors.brand,
            marginLeft: space.xs,
        },

        // ------------------------------------------------------------------
        // Row
        // ------------------------------------------------------------------
        rootRead: {
            ...getRowStyle(therrTheme),
        },
        rootUnread: {
            ...getRowStyle(therrTheme),
            borderLeftColor: therrTheme.colors.brand,
            backgroundColor: tint(therrTheme.colors.brand, 0.06),
        },
        // Inset hairline: starts past the icon column so the list reads as
        // grouped rows instead of a stack of full-width rules.
        rowDivider: {
            height: StyleSheet.hairlineWidth,
            marginLeft: space.lg + ICON_SIZE + space.md,
            backgroundColor: therrTheme.colors.accentDivider,
        },

        iconContainer: {
            width: ICON_SIZE,
            height: ICON_SIZE,
            borderRadius: radius.circle,
            alignItems: 'center',
            justifyContent: 'center',
            marginRight: space.md,
        },

        messageContainer: {
            flex: 1,
            paddingRight: space.sm,
        },
        messageRead: {
            fontFamily: therrFontFamily,
            fontSize: fontSizes.md,
            lineHeight: fontSizes.md * lineHeights.normal,
            color: therrTheme.colors.onSurfaceMuted,
        },
        messageUnread: {
            fontFamily: therrFontFamily,
            fontSize: fontSizes.md,
            lineHeight: fontSizes.md * lineHeights.normal,
            color: therrTheme.colors.onSurface,
            fontWeight: fontWeights.medium,
        },
        // Highlighted spans stay in the brand hue and lean on weight rather
        // than the old hyperlink-blue, which read as a broken link.
        highlightRead: {
            fontWeight: fontWeights.semibold,
            color: therrTheme.colors.onSurface,
        },
        highlightUnread: {
            fontWeight: fontWeights.bold,
            color: therrTheme.colors.brand,
        },

        metaRow: {
            flexDirection: 'row',
            alignItems: 'center',
            marginTop: space.xs,
        },
        dateText: {
            fontFamily: therrFontFamily,
            fontSize: fontSizes.xs,
            color: therrTheme.colors.onSurfaceMuted,
        },
        unreadDot: {
            width: 6,
            height: 6,
            borderRadius: radius.circle,
            backgroundColor: therrTheme.colors.brand,
            marginRight: space.sm,
        },

        // ------------------------------------------------------------------
        // Inline connection-request actions
        // ------------------------------------------------------------------
        actionsContainer: {
            flexDirection: 'row',
            flexWrap: 'wrap',
            marginTop: space.md,
        },
        actionButton: {
            flexDirection: 'row',
            alignItems: 'center',
            minHeight: 36,
            paddingHorizontal: space.md,
            borderRadius: radius.pill,
            marginRight: space.sm,
            marginTop: space.xs,
        },
        actionButtonPrimary: {
            backgroundColor: therrTheme.colors.brand,
            ...shadowSm,
        },
        actionButtonSecondary: {
            backgroundColor: 'transparent',
            borderWidth: 1,
            borderColor: therrTheme.colors.accentDivider,
        },
        actionButtonPressed: {
            opacity: 0.75,
        },
        actionButtonPrimaryText: {
            fontFamily: therrFontFamily,
            fontSize: fontSizes.sm,
            fontWeight: fontWeights.semibold,
            color: therrTheme.colors.onBrand,
            marginLeft: space.xs,
        },
        actionButtonSecondaryText: {
            fontFamily: therrFontFamily,
            fontSize: fontSizes.sm,
            fontWeight: fontWeights.semibold,
            color: therrTheme.colors.onSurfaceMuted,
            marginLeft: space.xs,
        },

        // ------------------------------------------------------------------
        // Read / unread toggle
        // ------------------------------------------------------------------
        readToggle: {
            width: READ_TOGGLE_HIT_SIZE,
            height: READ_TOGGLE_HIT_SIZE,
            alignItems: 'center',
            justifyContent: 'center',
        },
        iconUnread: {
            color: therrTheme.colors.brand,
        },
        iconRead: {
            color: therrTheme.colors.onSurfaceMuted,
        },
    });

    return ({
        ...therrTheme,
        styles,
    });
};

export {
    buildStyles,
    notifications,
    tint,
};
