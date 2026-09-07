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
import {
    buildJournalPalette,
    buildJournalThemeSwatch,
    IJournalSwatch,
    IJournalTypePalette,
} from './journalPalette';

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
 * day's entries stacked on the right as cards. The rail width is a constant
 * because the date block and the entry column have to line up across sections,
 * and a percentage would drift with the day number's width.
 *
 * COLOR CODING
 * ------------
 * Anything that varies per habit — the card's left rule, its icon disc, its
 * habit chip — takes its color from `palette` at render time rather than from a
 * style here, because the color depends on the row's data and `StyleSheet` is
 * built once per theme. `journalPalette.ts` explains how a slot is chosen and
 * why the palette is stored as hues. `typePalette` covers the rows that belong
 * to no habit at all.
 */
const DATE_RAIL_WIDTH = 76;

/** Width of the colored rule down the left edge of each entry card. */
const ENTRY_ACCENT_WIDTH = 3;

const buildStyles = (themeName?: IMobileThemeName) => {
    const therrTheme: ITherrTheme = getTheme(themeName);

    // Every colored fill in the journal is composited against the card surface,
    // so the palette is resolved against that same color rather than against
    // the screen background the cards sit on.
    const entrySurface = therrTheme.colors.surface;
    const palette: IJournalSwatch[] = buildJournalPalette(entrySurface);
    const typePalette: IJournalTypePalette = {
        goal: buildJournalThemeSwatch(therrTheme.colors.brand, entrySurface),
        achievement: buildJournalThemeSwatch(therrTheme.colors.accent, entrySurface),
        neutral: buildJournalThemeSwatch(therrTheme.colors.onSurfaceMuted, entrySurface),
    };

    return {
        colors: therrTheme.colors,
        palette,
        typePalette,
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
            // The heading and the rule share a row so the rule takes up the
            // width the month name leaves, which turns a bare bold word into a
            // visible break between months on a long scroll.
            monthHeadingRow: {
                flexDirection: 'row',
                alignItems: 'center',
                marginTop: space.lg,
                marginBottom: space.sm,
            },
            monthHeading: {
                fontFamily: therrFontFamily,
                fontSize: fontSizes.lg,
                fontWeight: fontWeights.bold,
                color: therrTheme.colors.onSurface,
                marginRight: space.md,
            },
            monthHeadingRule: {
                flex: 1,
                height: 2,
                borderRadius: 1,
                backgroundColor: tint(therrTheme.colors.brand, 0.3),
            },
            dayRow: {
                flexDirection: 'row',
                alignItems: 'flex-start',
            },
            dateBlock: {
                width: DATE_RAIL_WIDTH,
                paddingRight: space.md,
                // Matches the first entry card's `marginTop` so the date and
                // the card it labels start on the same line.
                paddingTop: space.sm,
            },
            dateCard: {
                backgroundColor: therrTheme.colors.surface,
                borderRadius: radius.md,
                paddingVertical: space.sm,
                alignItems: 'center',
                ...shadowSm,
            },
            // Today is the one date a journal is read from, so it is the one
            // date worth finding without reading any numbers.
            dateCardToday: {
                backgroundColor: typePalette.goal.tint,
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
            dateTextToday: {
                color: typePalette.goal.accent,
            },
            entryColumn: {
                flex: 1,
            },
            // A card rather than the hairline-separated block this replaced:
            // the colored rule down its left edge needs an edge to sit on, and
            // a card gives every row of a busy day its own boundary.
            entry: {
                flexDirection: 'row',
                alignItems: 'flex-start',
                backgroundColor: therrTheme.colors.surface,
                borderRadius: radius.md,
                borderLeftWidth: ENTRY_ACCENT_WIDTH,
                // `borderLeftColor` is set per row from the row's swatch.
                borderLeftColor: 'transparent',
                paddingVertical: space.md,
                paddingLeft: space.sm,
                paddingRight: space.md,
                marginTop: space.sm,
                ...shadowSm,
            },
            // Hue says which habit, glyph says what happened — see
            // `journalPalette.ts`. The disc keeps glyphs on a common baseline
            // the way `habitCardEmojiContainer` does elsewhere in habits.
            entryIconCircle: {
                width: 28,
                height: 28,
                borderRadius: radius.circle,
                alignItems: 'center',
                justifyContent: 'center',
                marginRight: space.sm,
                // Optical alignment with the cap height of the first body line
                // rather than with its line box.
                marginTop: 1,
            },
            entryContent: {
                flex: 1,
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
            // Carries the row's habit color: the chip names the habit in words,
            // the color is the same one the card's rule and disc are drawn in,
            // which is what teaches the mapping without a legend.
            chipHabitLabel: {
                fontFamily: therrFontFamily,
                fontSize: fontSizes.xs,
                fontWeight: fontWeights.semibold,
            },
            // A goal is the one row type that leaves the journal when tapped, so
            // it is tinted rather than neutral — the chip is what tells the user
            // this row is a post and not a note.
            chipGoal: {
                backgroundColor: typePalette.goal.tint,
            },
            chipGoalLabel: {
                fontFamily: therrFontFamily,
                fontSize: fontSizes.xs,
                fontWeight: fontWeights.bold,
                color: typePalette.goal.accent,
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
                backgroundColor: typePalette.goal.tint,
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
                flexDirection: 'row',
                alignItems: 'center',
                borderRadius: radius.pill,
                paddingHorizontal: space.md,
                paddingVertical: space.sm,
                marginRight: space.sm,
                marginTop: space.sm,
                borderWidth: 1,
                borderColor: tint(therrTheme.colors.onSurfaceMuted, 0.35),
            },
            // The tag row doubles as the screen's legend: every habit shows its
            // dot here in the same color its entries carry in the feed, which is
            // why the dot stays visible on unselected tags too.
            composerTagDot: {
                width: 8,
                height: 8,
                borderRadius: radius.circle,
                marginRight: space.sm,
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
                backgroundColor: therrTheme.colors.brand,
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
                // `onBrand`, not `textWhite`: the latter is the theme's default
                // body color (#363636 on light), so on a filled brand button it
                // reads as dark gray rather than as a label.
                color: therrTheme.colors.onBrand,
            },
        }),
    };
};

export { buildStyles, DATE_RAIL_WIDTH };
