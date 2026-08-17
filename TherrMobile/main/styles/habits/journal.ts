import { StyleSheet } from 'react-native';
import Color from 'color';
import { IMobileThemeName } from 'therr-react/types';
import { therrFontFamily } from '../font';
import { fontSizes, fontWeights, lineHeights } from '../text';
import { space } from '../layouts/spacing';
import { radius } from '../radii';
import { shadowSm } from '../elevation';
import { buttonMenuHeight } from '../navigation/buttonMenu';
import { getTheme, ITherrTheme } from '../themes';

const tint = (color: string, alpha: number) => new Color(color).alpha(alpha).string();

/**
 * Journal styles.
 *
 * Kept in their own module rather than appended to `styles/habits/index.ts`,
 * which is already 1,100+ lines covering every other habits surface. The
 * journal shares that file's tokens (`space`, `radius`, `fontSizes`) so the two
 * stay visually consistent without one importing the other.
 *
 * The layout is a two-column rail: a fixed-width date block on the left, the
 * day's entries stacked on the right with a hairline between them. The rail
 * width is a constant because the date block and the entry column have to line
 * up across sections, and a percentage would drift with the day number's width.
 */
const DATE_RAIL_WIDTH = 76;

const buildStyles = (themeName?: IMobileThemeName) => {
    const therrTheme: ITherrTheme = getTheme(themeName);

    return {
        colors: therrTheme.colors,
        styles: StyleSheet.create({
            container: {
                flex: 1,
                backgroundColor: therrTheme.colors.backgroundGray,
            },
            listContent: {
                paddingHorizontal: space.lg,
                // Clears both the compose action and the button menu, matching
                // `newPactFabClearance` on the dashboard.
                paddingBottom: buttonMenuHeight + 48 + (space.lg * 2),
            },
            header: {
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingTop: space.lg,
                paddingBottom: space.sm,
            },
            headerTitle: {
                fontFamily: therrFontFamily,
                fontSize: fontSizes.xxl,
                lineHeight: fontSizes.xxl * lineHeights.tight,
                fontWeight: fontWeights.bold,
                color: therrTheme.colors.onSurface,
            },
            headerAction: {
                width: 40,
                height: 40,
                alignItems: 'center',
                justifyContent: 'center',
            },
            monthHeading: {
                fontFamily: therrFontFamily,
                fontSize: fontSizes.lg,
                fontWeight: fontWeights.bold,
                color: therrTheme.colors.onSurface,
                marginTop: space.lg,
                marginBottom: space.sm,
            },
            dayRow: {
                flexDirection: 'row',
                alignItems: 'flex-start',
            },
            dateBlock: {
                width: DATE_RAIL_WIDTH,
                paddingRight: space.md,
                paddingTop: space.md,
            },
            dateCard: {
                backgroundColor: therrTheme.colors.surface,
                borderRadius: radius.md,
                paddingVertical: space.sm,
                alignItems: 'center',
                ...shadowSm,
            },
            dateWeekday: {
                fontFamily: therrFontFamily,
                fontSize: fontSizes.xs,
                fontWeight: fontWeights.bold,
                letterSpacing: 0.5,
                textTransform: 'uppercase',
                color: therrTheme.colors.onSurfaceMuted,
            },
            dateDay: {
                fontFamily: therrFontFamily,
                fontSize: fontSizes.xl,
                lineHeight: fontSizes.xl * lineHeights.tight,
                fontWeight: fontWeights.bold,
                color: therrTheme.colors.onSurface,
            },
            entryColumn: {
                flex: 1,
            },
            entry: {
                paddingVertical: space.md,
                borderBottomWidth: StyleSheet.hairlineWidth,
                borderBottomColor: tint(therrTheme.colors.onSurfaceMuted, 0.25),
            },
            entryBody: {
                fontFamily: therrFontFamily,
                fontSize: fontSizes.md,
                lineHeight: fontSizes.md * lineHeights.normal,
                color: therrTheme.colors.onSurface,
            },
            entryMetaRow: {
                flexDirection: 'row',
                alignItems: 'center',
                flexWrap: 'wrap',
                marginTop: space.sm,
            },
            chip: {
                borderRadius: radius.pill,
                paddingHorizontal: space.sm,
                paddingVertical: space.xs,
                marginRight: space.sm,
                marginTop: space.xs,
            },
            chipTime: {
                backgroundColor: tint(therrTheme.colors.onSurfaceMuted, 0.12),
            },
            chipLabel: {
                fontFamily: therrFontFamily,
                fontSize: fontSizes.xs,
                color: therrTheme.colors.onSurfaceMuted,
            },
            chipHabitLabel: {
                fontFamily: therrFontFamily,
                fontSize: fontSizes.xs,
                color: therrTheme.colors.onSurface,
            },
            // A goal is the one row type that leaves the journal when tapped, so
            // it is tinted rather than neutral — the chip is what tells the user
            // this row is a post and not a note.
            chipGoal: {
                backgroundColor: tint(therrTheme.colors.primary, 0.14),
            },
            chipGoalLabel: {
                fontFamily: therrFontFamily,
                fontSize: fontSizes.xs,
                fontWeight: fontWeights.bold,
                color: therrTheme.colors.primary,
            },
            entryPressed: {
                opacity: 0.6,
            },
            emptyContainer: {
                alignItems: 'center',
                paddingTop: space.xxxl,
                paddingHorizontal: space.xl,
            },
            emptyTitle: {
                fontFamily: therrFontFamily,
                fontSize: fontSizes.lg,
                fontWeight: fontWeights.bold,
                color: therrTheme.colors.onSurface,
                textAlign: 'center',
                marginBottom: space.sm,
            },
            emptySubtitle: {
                fontFamily: therrFontFamily,
                fontSize: fontSizes.sm,
                lineHeight: fontSizes.sm * lineHeights.normal,
                color: therrTheme.colors.onSurfaceMuted,
                textAlign: 'center',
            },
            footerLoading: {
                paddingVertical: space.lg,
                alignItems: 'center',
            },

            // Create picker — "journal entry or goal?"
            createOptionRow: {
                flexDirection: 'row',
                alignItems: 'center',
                paddingVertical: space.md,
                paddingHorizontal: space.sm,
                borderRadius: radius.md,
                gap: space.md,
            },
            createOptionRowPressed: {
                backgroundColor: tint(therrTheme.colors.onSurfaceMuted, 0.12),
            },
            createOptionIconCircle: {
                width: 44,
                height: 44,
                borderRadius: radius.circle,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: tint(therrTheme.colors.primary, 0.15),
            },
            createOptionTextGroup: {
                flex: 1,
            },
            createOptionTitle: {
                fontFamily: therrFontFamily,
                fontSize: fontSizes.md,
                fontWeight: fontWeights.semibold,
                color: therrTheme.colors.onSurface,
            },
            createOptionSubtitle: {
                fontFamily: therrFontFamily,
                fontSize: fontSizes.xs,
                lineHeight: fontSizes.xs * lineHeights.normal,
                color: therrTheme.colors.onSurfaceMuted,
                marginTop: 2,
            },

            // Composer
            composerBackdrop: {
                flex: 1,
                justifyContent: 'flex-end',
                backgroundColor: 'rgba(0, 0, 0, 0.45)',
            },
            composerSheet: {
                backgroundColor: therrTheme.colors.surface,
                borderTopLeftRadius: radius.lg,
                borderTopRightRadius: radius.lg,
                padding: space.lg,
            },
            composerTitle: {
                fontFamily: therrFontFamily,
                fontSize: fontSizes.lg,
                fontWeight: fontWeights.bold,
                color: therrTheme.colors.onSurface,
                marginBottom: space.md,
            },
            composerInput: {
                fontFamily: therrFontFamily,
                fontSize: fontSizes.md,
                lineHeight: fontSizes.md * lineHeights.normal,
                color: therrTheme.colors.onSurface,
                backgroundColor: therrTheme.colors.backgroundGray,
                borderRadius: radius.md,
                padding: space.md,
                minHeight: 120,
                textAlignVertical: 'top',
            },
            composerTagRow: {
                flexDirection: 'row',
                flexWrap: 'wrap',
                marginTop: space.md,
            },
            composerTag: {
                borderRadius: radius.pill,
                paddingHorizontal: space.md,
                paddingVertical: space.sm,
                marginRight: space.sm,
                marginTop: space.sm,
                borderWidth: 1,
                borderColor: tint(therrTheme.colors.onSurfaceMuted, 0.35),
            },
            composerTagSelected: {
                backgroundColor: tint(therrTheme.colors.primary, 0.15),
                borderColor: therrTheme.colors.primary,
            },
            composerTagLabel: {
                fontFamily: therrFontFamily,
                fontSize: fontSizes.xs,
                color: therrTheme.colors.onSurface,
            },
            composerActions: {
                flexDirection: 'row',
                justifyContent: 'flex-end',
                marginTop: space.lg,
            },
            composerButton: {
                paddingHorizontal: space.lg,
                paddingVertical: space.md,
                borderRadius: radius.md,
                marginLeft: space.sm,
            },
            composerButtonPrimary: {
                backgroundColor: therrTheme.colors.primary,
            },
            composerButtonLabel: {
                fontFamily: therrFontFamily,
                fontSize: fontSizes.sm,
                fontWeight: fontWeights.bold,
                color: therrTheme.colors.onSurfaceMuted,
            },
            composerButtonLabelPrimary: {
                fontFamily: therrFontFamily,
                fontSize: fontSizes.sm,
                fontWeight: fontWeights.bold,
                color: therrTheme.colors.textWhite,
            },
        }),
    };
};

export { buildStyles, DATE_RAIL_WIDTH };
