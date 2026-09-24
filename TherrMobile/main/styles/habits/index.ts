import { StyleSheet } from 'react-native';
import Color from 'color';
import { IMobileThemeName } from 'therr-react/types';
import { therrFontFamily } from '../font';
import { fontSizes, fontWeights, lineHeights } from '../text';
import { space } from '../layouts/spacing';
import { radius } from '../radii';
import { shadowMd, shadowSm } from '../elevation';
import { buttonMenuHeight } from '../navigation/buttonMenu';
import { getTheme, isDarkTheme, ITherrTheme } from '../themes';
import { BRAND_WHITE } from '../themes/brandConstants';

const tint = (color: string, alpha: number) => new Color(color).alpha(alpha).string();

/**
 * Colours for the streak progress bar, picked as a *pair* for contrast against each other
 * rather than taken off the brand ramp in sequence.
 *
 * The bar used to be `primary3` on `primary4`. On Friends with Habits those are `#6E5C85` and
 * `#5B4273` — two dark purples one step apart, measuring **1.4:1**. WCAG 1.4.11 asks for 3:1 on
 * a non-text indicator like this, so the fill was effectively invisible and the bar read as a
 * flat purple slab at every streak length.
 *
 * The track is a fixed veil of the on-surface colour, so it follows the theme automatically and
 * stays subordinate to the card it sits on. The fill has to flip with the theme to clear 3:1
 * against that track in both directions — a colour dark enough to contrast against a light track
 * is by definition too light-starved to contrast against a dark one. Lightening the brand colour
 * (rather than switching to the accent) keeps the bar the app's own hue either way.
 *
 * Measured against the composited track, brand x theme:
 *   HABITS light 4.4:1 · HABITS dark 4.3:1 · THERR light 3.5:1 · THERR dark 4.7:1
 * Re-measure if `brand`, `onSurface` or `surface` moves.
 */
const TRACK_VEIL_ALPHA = 0.16;
const getStreakBarColors = (theme: ITherrTheme, themeName?: IMobileThemeName) => ({
    track: tint(theme.colors.onSurface, TRACK_VEIL_ALPHA),
    fill: isDarkTheme(themeName)
        ? new Color(theme.colors.brand).lighten(0.6).hex()
        : theme.colors.brand,
});

// Height of the floating "new pact" action, and the bottom padding a scrolling
// surface needs so its last row clears both that action and the button menu.
const NEW_PACT_FAB_HEIGHT = 48;
const newPactFabClearance = buttonMenuHeight + NEW_PACT_FAB_HEIGHT + (space.lg * 2);

const getCheckinButtonStyles = (_theme: ITherrTheme): any => ({
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
});

const getStreakBadgeStyles = (_theme: ITherrTheme): any => ({
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
});

const buildStyles = (themeName?: IMobileThemeName) => {
    const therrTheme = getTheme(themeName);
    const streakBar = getStreakBarColors(therrTheme, themeName);

    const styles = StyleSheet.create({
        // Checkin Button
        checkinButtonContainer: {
            marginVertical: 8,
            marginHorizontal: 16,
        },
        checkinButton: {
            ...getCheckinButtonStyles(therrTheme),
            backgroundColor: therrTheme.colors.primary3,
        },
        checkinButtonCompleted: {
            ...getCheckinButtonStyles(therrTheme),
            backgroundColor: therrTheme.colors.brandingBlueGreen,
        },
        checkinButtonDisabled: {
            ...getCheckinButtonStyles(therrTheme),
            backgroundColor: therrTheme.colors.primary4,
            opacity: 0.6,
        },
        checkinButtonText: {
            fontFamily: therrFontFamily,
            fontSize: 18,
            fontWeight: '600',
            color: therrTheme.colors.brandingWhite,
            marginLeft: 10,
        },
        checkinButtonIcon: {
            color: therrTheme.colors.brandingWhite,
        },
        // Wraps the completed button and its "add a note or photo" link so the
        // link sits directly beneath the button rather than beside it.
        checkinButtonWithDetailContainer: {
            alignSelf: 'stretch',
        },
        checkinAddDetailButton: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            alignSelf: 'center',
            marginTop: 2,
            marginBottom: 4,
            paddingVertical: 6,
            paddingHorizontal: 12,
            gap: 6,
        },
        checkinAddDetailText: {
            fontFamily: therrFontFamily,
            fontSize: 14,
            fontWeight: '600',
            color: therrTheme.colors.primary3,
        },
        checkinAddDetailIcon: {
            color: therrTheme.colors.primary3,
        },

        // Streak Widget
        streakWidgetContainer: {
            padding: 16,
            marginHorizontal: 16,
            marginVertical: 8,
            borderRadius: 16,
            backgroundColor: therrTheme.colors.surface,
            shadowColor: therrTheme.colors.textBlack,
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.1,
            shadowRadius: 4,
            elevation: 2,
        },
        streakWidgetHeader: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 12,
            gap: 12,
        },
        streakWidgetTitle: {
            fontFamily: therrFontFamily,
            fontSize: 16,
            fontWeight: '600',
            color: therrTheme.colors.onSurface,
            flexShrink: 1,
        },
        streakBadge: {
            ...getStreakBadgeStyles(therrTheme),
            backgroundColor: therrTheme.colors.brandingMapYellow,
        },
        streakBadgeSafe: {
            ...getStreakBadgeStyles(therrTheme),
            backgroundColor: therrTheme.colors.brandingBlueGreen,
        },
        streakBadgeAtRisk: {
            ...getStreakBadgeStyles(therrTheme),
            backgroundColor: therrTheme.colors.brandingMapYellow,
        },
        streakBadgeCritical: {
            ...getStreakBadgeStyles(therrTheme),
            backgroundColor: therrTheme.colors.accentRed,
        },
        streakBadgeText: {
            fontFamily: therrFontFamily,
            fontSize: 14,
            fontWeight: '700',
            color: therrTheme.colors.brandingWhite,
            marginLeft: 4,
        },
        streakBadgeEmoji: {
            fontSize: 16,
        },
        streakProgressContainer: {
            marginTop: 8,
        },
        // See `getStreakBarColors` — these two are a measured contrast pair, not brand-ramp
        // neighbours. Changing either in isolation is what produced the invisible bar.
        streakProgressBar: {
            height: 10,
            borderRadius: radius.pill,
            backgroundColor: streakBar.track,
            overflow: 'hidden',
        },
        streakProgressFill: {
            height: '100%',
            borderRadius: radius.pill,
            backgroundColor: streakBar.fill,
        },
        streakProgressText: {
            fontFamily: therrFontFamily,
            fontSize: 12,
            fontWeight: fontWeights.semibold,
            color: therrTheme.colors.onSurface,
            marginTop: 4,
            textAlign: 'right',
        },
        streakMilestoneText: {
            fontFamily: therrFontFamily,
            fontSize: 12,
            color: therrTheme.colors.onSurfaceMuted,
        },

        // Per-habit notification switches (components/Habits/HabitNotificationSettings)
        habitNotificationPrefsCaption: {
            fontFamily: therrFontFamily,
            fontSize: fontSizes.sm,
            color: therrTheme.colors.onSurfaceMuted,
            marginTop: space.xs,
            marginBottom: space.sm,
        },
        habitNotificationPrefsRow: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingVertical: space.sm,
        },
        habitNotificationPrefsLabelContainer: {
            // The switch is a fixed-width control, so the label column takes the
            // rest. Without `flex: 1` a two-line hint pushes the switch off the
            // right edge instead of wrapping.
            flex: 1,
            paddingRight: space.md,
        },
        habitNotificationPrefsLabel: {
            fontFamily: therrFontFamily,
            fontSize: fontSizes.md,
            fontWeight: fontWeights.semibold,
            color: therrTheme.colors.onSurface,
        },
        habitNotificationPrefsHint: {
            fontFamily: therrFontFamily,
            fontSize: fontSizes.sm,
            color: therrTheme.colors.onSurfaceMuted,
            marginTop: 2,
        },
        habitNotificationPrefsSpinner: {
            // Matches the Switch's laid-out width so a row does not jump sideways
            // while its write is in flight.
            width: 52,
        },
        habitNotificationPrefsFootnote: {
            fontFamily: therrFontFamily,
            fontSize: 12,
            color: therrTheme.colors.onSurfaceMuted,
            marginTop: space.sm,
            fontStyle: 'italic',
        },

        // "Archive habit" on the habit detail screen. Destructive-adjacent but
        // reversible, so it is a quiet text action rather than a filled button —
        // it must be findable, not inviting.
        habitDangerZone: {
            marginHorizontal: space.lg,
            marginTop: space.sm,
            marginBottom: space.lg,
            alignItems: 'center',
        },
        habitArchiveAction: {
            paddingVertical: space.sm + 2,
            paddingHorizontal: space.lg,
        },
        habitArchiveActionText: {
            fontFamily: therrFontFamily,
            fontSize: fontSizes.md,
            fontWeight: fontWeights.semibold,
            color: therrTheme.colors.textGray,
        },
        habitArchiveHint: {
            fontFamily: therrFontFamily,
            fontSize: 12,
            color: therrTheme.colors.onSurfaceMuted,
            textAlign: 'center',
            marginTop: 2,
        },

        // Streak freezes
        // A count in a sentence ("2 streak freezes left") makes the reader parse prose to learn
        // how much cover they have. One pip per freeze the habit was allotted, spent ones struck
        // through, answers it at a glance and — unlike the sentence — also shows how many there
        // were to begin with.
        streakFreezeSection: {
            marginTop: space.md,
        },
        streakFreezeHeaderRow: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: space.sm,
        },
        streakFreezeLabel: {
            fontFamily: therrFontFamily,
            fontSize: 12,
            fontWeight: fontWeights.semibold,
            color: therrTheme.colors.onSurface,
        },
        streakFreezePipRow: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 4,
            flexShrink: 1,
            flexWrap: 'wrap',
        },
        streakFreezePip: {
            width: 20,
            height: 20,
            borderRadius: radius.circle,
            alignItems: 'center',
            justifyContent: 'center',
            borderWidth: 1,
        },
        streakFreezePipAvailable: {
            backgroundColor: tint(therrTheme.colors.brand, 0.16),
            borderColor: therrTheme.colors.brand,
        },
        // Spent freezes keep their slot — that is the point of showing the full allotment — but
        // drop to a bare outline so "used" and "left" are separable without reading the caption.
        streakFreezePipSpent: {
            backgroundColor: 'transparent',
            borderColor: tint(therrTheme.colors.onSurface, 0.3),
            opacity: 0.5,
        },
        streakFreezePipText: {
            fontSize: 11,
            lineHeight: 14,
        },
        streakFreezeOverflowText: {
            fontFamily: therrFontFamily,
            fontSize: 11,
            fontWeight: fontWeights.semibold,
            color: therrTheme.colors.onSurfaceMuted,
        },
        streakFreezeCaption: {
            fontFamily: therrFontFamily,
            fontSize: 12,
            color: therrTheme.colors.onSurfaceMuted,
            marginTop: space.xs,
        },
        // The caption turns into a warning once nothing is left to spend: the next missed day
        // ends the streak, which is the one state the user has to act on.
        streakFreezeCaptionExhausted: {
            color: therrTheme.colors.accentRed,
        },

        // Streak Widget — compact variant
        // Used on the profile header, where the widget competes for vertical space
        // with the tab content below it. Same information, collapsed from four
        // stacked rows into two: title + badge, then the progress bar with its
        // milestone/grace summary inline beside it.
        streakWidgetContainerCompact: {
            // ViewUser's parent container centers its children (`alignItems: 'center'`),
            // which makes an unconstrained child shrink to fit its content instead of
            // filling the row. Matches the treatment in styles/profileCompletionLink.
            alignSelf: 'stretch',
            paddingVertical: space.sm,
            paddingHorizontal: space.md,
            marginHorizontal: space.lg,
            marginVertical: space.xs,
            borderRadius: radius.lg,
            backgroundColor: therrTheme.colors.surface,
        },
        streakWidgetHeaderCompact: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: space.sm,
        },
        streakWidgetTitleCompact: {
            fontSize: fontSizes.sm,
        },
        streakBadgeCompact: {
            paddingVertical: space.xs,
            paddingHorizontal: space.md,
            borderRadius: radius.pill,
        },
        streakBadgeTextCompact: {
            fontSize: fontSizes.xs,
        },
        streakBadgeEmojiCompact: {
            fontSize: fontSizes.sm,
        },
        streakProgressRowCompact: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: space.sm,
            marginTop: space.xs + 2,
        },
        streakProgressBarCompact: {
            flex: 1,
            minWidth: 48,
            height: 5,
            borderRadius: radius.pill,
        },
        streakProgressFillCompact: {
            borderRadius: radius.pill,
        },
        streakMetaTextCompact: {
            fontFamily: therrFontFamily,
            fontSize: 11,
            color: therrTheme.colors.onSurfaceMuted,
            flexShrink: 1,
        },

        // Streak Widget — embedded variant
        // Strips the widget's own card chrome for call sites that render it *inside* another
        // card. `HabitCard` is the one that matters: the widget's surface colour, shadow,
        // padding and 16dp side margins were being drawn on top of the card's own, so every
        // habit row carried a card-within-a-card and paid for two sets of insets.
        streakWidgetContainerEmbedded: {
            alignSelf: 'stretch',
            backgroundColor: 'transparent',
            paddingHorizontal: 0,
            paddingVertical: 0,
            marginHorizontal: 0,
            marginVertical: 0,
            borderRadius: 0,
            shadowOpacity: 0,
            elevation: 0,
            marginTop: space.sm,
        },
        // Compact freeze pips sit on the meta row beside the bar, so they lose the section's
        // top margin and the caption entirely — the full widget on the habit detail screen is
        // where the rule gets explained.
        streakFreezeRowCompact: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 3,
        },
        streakFreezePipCompact: {
            width: 14,
            height: 14,
            borderWidth: 1,
        },
        streakFreezePipTextCompact: {
            fontSize: 8,
            lineHeight: 10,
        },

        // Habit Card
        // Tuned for a list, not for a hero. Every value below used to be a step larger, which
        // cost roughly a third of the row height and left two or three habits visible on a
        // phone — on the one screen whose job is to let someone check in on all of them.
        habitCardContainer: {
            backgroundColor: therrTheme.colors.surface,
            borderRadius: radius.lg,
            padding: space.md,
            marginHorizontal: space.lg,
            marginVertical: space.xs + 2,
            ...shadowSm,
        },
        habitCardHeader: {
            flexDirection: 'row',
            alignItems: 'center',
            marginBottom: space.sm,
        },
        habitCardEmoji: {
            fontSize: 28,
            marginRight: space.sm,
        },
        // Opt-in contained variant: a tinted disc so habit glyphs sit on a
        // consistent baseline instead of each emoji's own optical box. Used by
        // the pact cards; the bare `habitCardEmoji` above is retained for the
        // call sites that have not adopted it.
        habitCardEmojiContainer: {
            width: 44,
            height: 44,
            borderRadius: radius.circle,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: tint(therrTheme.colors.brand, 0.10),
            marginRight: space.md,
        },
        habitCardEmojiContained: {
            fontSize: 22,
        },
        habitCardTitleContainer: {
            flex: 1,
        },
        habitCardTitle: {
            fontFamily: therrFontFamily,
            fontSize: fontSizes.lg,
            fontWeight: fontWeights.semibold,
            color: therrTheme.colors.onSurface,
        },
        habitCardSubtitle: {
            fontFamily: therrFontFamily,
            fontSize: fontSizes.sm,
            color: therrTheme.colors.onSurfaceMuted,
            marginTop: 2,
        },
        habitCardBody: {
            marginTop: space.xs + 2,
        },

        /**
         * "2 of 4 this week" on a habit card.
         *
         * Only rendered for a habit whose cadence asks for fewer than seven check-ins — a daily
         * habit's progress is already the streak. Tinted rather than filled so it reads as a
         * status, not an action, beside the check-in button it sits near.
         */
        habitCardProgressChip: {
            alignSelf: 'flex-start',
            marginTop: space.xs,
            paddingHorizontal: space.sm,
            paddingVertical: 2,
            borderRadius: radius.sm,
            backgroundColor: tint(therrTheme.colors.brand, 0.14),
        },
        habitCardProgressChipMet: {
            backgroundColor: tint(therrTheme.colors.brand, 0.28),
        },
        habitCardProgressChipText: {
            fontFamily: therrFontFamily,
            fontSize: fontSizes.xs,
            fontWeight: fontWeights.semibold,
            color: therrTheme.colors.onSurface,
        },

        // ── Cadence picker (components/Habits/CadencePicker) ─────────────────────────────
        cadenceSection: {
            paddingHorizontal: space.lg,
            marginTop: space.md,
        },
        cadenceSectionLabel: {
            fontFamily: therrFontFamily,
            fontSize: fontSizes.sm,
            fontWeight: fontWeights.semibold,
            color: therrTheme.colors.onSurface,
            marginBottom: space.xs,
        },
        // Deliberately the same selectable-row shape the wizard's template list already uses,
        // so the cadence choice reads as part of the same step rather than a new control.
        cadenceOption: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: therrTheme.colors.surface,
            borderRadius: radius.md,
            borderWidth: 1,
            borderColor: tint(therrTheme.colors.onSurface, 0.16),
            paddingHorizontal: space.md,
            paddingVertical: space.sm,
            marginBottom: space.xs,
        },
        cadenceOptionSelected: {
            borderWidth: 2,
            borderColor: therrTheme.colors.brand,
        },
        cadenceOptionText: {
            fontFamily: therrFontFamily,
            fontSize: fontSizes.md,
            color: therrTheme.colors.onSurface,
        },
        cadenceOptionTextSelected: {
            fontWeight: fontWeights.semibold,
        },
        cadenceStepperRow: {
            flexDirection: 'row',
            alignItems: 'center',
        },
        cadenceStepperButton: {
            width: 32,
            height: 32,
            borderRadius: radius.sm,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: tint(therrTheme.colors.onSurface, 0.1),
        },
        cadenceStepperButtonDisabled: {
            opacity: 0.4,
        },
        cadenceStepperButtonText: {
            fontFamily: therrFontFamily,
            fontSize: fontSizes.lg,
            fontWeight: fontWeights.semibold,
            color: therrTheme.colors.onSurface,
        },
        cadenceStepperValue: {
            fontFamily: therrFontFamily,
            fontSize: fontSizes.md,
            fontWeight: fontWeights.semibold,
            color: therrTheme.colors.onSurface,
            minWidth: 28,
            textAlign: 'center',
        },
        cadenceWeekdayRow: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            marginTop: space.xs,
            marginBottom: space.xs,
        },
        cadenceWeekdayChip: {
            // 44pt is the platform minimum touch target; seven of them have to fit a phone
            // width, so this is the floor rather than a design preference.
            minWidth: 40,
            height: 40,
            borderRadius: 20,
            alignItems: 'center',
            justifyContent: 'center',
            borderWidth: 1,
            borderColor: tint(therrTheme.colors.onSurface, 0.16),
        },
        cadenceWeekdayChipSelected: {
            backgroundColor: therrTheme.colors.brand,
            borderColor: therrTheme.colors.brand,
        },
        cadenceWeekdayChipText: {
            fontFamily: therrFontFamily,
            fontSize: fontSizes.xs,
            color: therrTheme.colors.onSurface,
        },
        cadenceWeekdayChipTextSelected: {
            color: therrTheme.colors.onBrand,
            fontWeight: fontWeights.semibold,
        },
        cadenceHint: {
            fontFamily: therrFontFamily,
            fontSize: fontSizes.xs,
            color: therrTheme.colors.onSurfaceMuted,
            marginTop: space.xs,
        },
        cadenceHintWarning: {
            // `accent` is the palette's non-brand emphasis colour and exists on every theme;
            // there is no semantic error colour, and the brand colour would read as a
            // selectable option rather than as "this needs your attention".
            color: therrTheme.colors.accent,
        },

        // The habit detail screen's cadence line. Sits inside the stats card, so it carries no
        // surface of its own — only a rule above it separating it from the two stat tiles.
        cadenceRow: {
            flexDirection: 'row',
            alignItems: 'center',
            marginTop: space.sm,
            paddingTop: space.sm,
            borderTopWidth: StyleSheet.hairlineWidth,
            borderTopColor: tint(therrTheme.colors.onSurface, 0.16),
        },
        cadenceRowLabel: {
            fontFamily: therrFontFamily,
            fontSize: fontSizes.sm,
            color: therrTheme.colors.onSurfaceMuted,
        },
        cadenceRowValue: {
            fontFamily: therrFontFamily,
            fontSize: fontSizes.sm,
            fontWeight: fontWeights.semibold,
            color: therrTheme.colors.onSurface,
            flex: 1,
            marginLeft: space.xs,
        },
        cadenceRowEditButton: {
            paddingVertical: space.xs,
            paddingHorizontal: space.sm,
        },
        cadenceRowEditText: {
            fontFamily: therrFontFamily,
            fontSize: fontSizes.sm,
            fontWeight: fontWeights.semibold,
            color: therrTheme.colors.brand,
        },

        habitCardFooter: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginTop: space.md,
            paddingTop: space.sm,
            borderTopWidth: StyleSheet.hairlineWidth,
            borderTopColor: tint(therrTheme.colors.onSurface, 0.16),
        },
        habitCardPartnerText: {
            fontFamily: therrFontFamily,
            fontSize: 13,
            color: therrTheme.colors.onSurfaceMuted,
            marginTop: space.xs + 2,
        },
        habitCardAwaitingText: {
            fontFamily: therrFontFamily,
            fontSize: 13,
            fontStyle: 'italic',
            color: therrTheme.colors.onSurfaceMuted,
            marginTop: space.md,
            paddingTop: space.sm,
            borderTopWidth: StyleSheet.hairlineWidth,
            borderTopColor: tint(therrTheme.colors.onSurface, 0.16),
        },

        // "Continue solo / archive?" prompt on an awaiting-partner card — the
        // escape hatch from reminders for a habit nobody has joined.
        habitCardSoloPrompt: {
            marginTop: 12,
        },
        habitCardSoloPromptText: {
            fontFamily: therrFontFamily,
            fontSize: 13,
            color: therrTheme.colors.onSurfaceMuted,
            marginBottom: 10,
        },
        habitCardSoloActions: {
            flexDirection: 'row',
            alignItems: 'center',
        },
        habitCardSoloButton: {
            flex: 1,
            backgroundColor: therrTheme.colors.brand,
            borderRadius: 10,
            paddingVertical: 10,
            paddingHorizontal: 12,
            alignItems: 'center',
            marginRight: 8,
        },
        habitCardSoloButtonText: {
            fontFamily: therrFontFamily,
            fontSize: 14,
            fontWeight: '600',
            color: therrTheme.colors.onBrand,
        },
        habitCardArchiveButton: {
            flex: 1,
            backgroundColor: therrTheme.colors.surface,
            borderRadius: 10,
            borderWidth: 1,
            borderColor: therrTheme.colors.primary4,
            paddingVertical: 10,
            paddingHorizontal: 12,
            alignItems: 'center',
        },
        habitCardArchiveButtonText: {
            fontFamily: therrFontFamily,
            fontSize: 14,
            fontWeight: '600',
            color: therrTheme.colors.textGray,
        },
        habitCardSoloSpinner: {
            alignSelf: 'flex-start',
            paddingVertical: 10,
        },

        // Calendar
        calendarContainer: {
            backgroundColor: therrTheme.colors.surface,
            borderRadius: 16,
            padding: 16,
            marginHorizontal: 16,
            marginVertical: 8,
        },
        calendarHeader: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 16,
        },
        calendarTitle: {
            fontFamily: therrFontFamily,
            fontSize: 18,
            fontWeight: '600',
            color: therrTheme.colors.onSurface,
        },
        calendarNavButton: {
            padding: 8,
        },
        calendarGrid: {
            flexDirection: 'row',
            flexWrap: 'wrap',
        },
        calendarDayHeader: {
            width: '14.28%',
            alignItems: 'center',
            paddingVertical: 8,
        },
        calendarDayHeaderText: {
            fontFamily: therrFontFamily,
            fontSize: 12,
            fontWeight: '600',
            color: therrTheme.colors.textGray,
        },
        calendarDay: {
            width: '14.28%',
            aspectRatio: 1,
            alignItems: 'center',
            justifyContent: 'center',
        },
        calendarDayCircle: {
            width: 36,
            height: 36,
            borderRadius: 18,
            alignItems: 'center',
            justifyContent: 'center',
        },
        calendarDayCompleted: {
            backgroundColor: therrTheme.colors.brandingBlueGreen,
        },
        calendarDayPartial: {
            backgroundColor: therrTheme.colors.brandingMapYellow,
        },
        calendarDayMissed: {
            backgroundColor: therrTheme.colors.accentRed,
        },
        calendarDaySkipped: {
            backgroundColor: therrTheme.colors.primary4,
        },
        calendarDayToday: {
            borderWidth: 2,
            borderColor: therrTheme.colors.primary3,
        },
        // Sits below the day circle rather than on it: the circle is already
        // carrying status via its fill, and overlaying a second signal on the
        // same 36pt target makes both harder to read at a glance.
        calendarDayProofDot: {
            width: 5,
            height: 5,
            borderRadius: 2.5,
            marginTop: 2,
            backgroundColor: therrTheme.colors.primary3,
        },
        calendarDayText: {
            fontFamily: therrFontFamily,
            fontSize: 14,
            color: therrTheme.colors.onSurface,
        },
        calendarDayTextCompleted: {
            color: therrTheme.colors.brandingWhite,
        },

        // Pact Card
        pactCardContainer: {
            backgroundColor: therrTheme.colors.surface,
            borderRadius: radius.xl,
            padding: space.lg,
            marginHorizontal: space.lg,
            marginVertical: space.sm,
            ...shadowSm,
        },
        pactCardContainerPressed: {
            opacity: 0.9,
        },
        // Status badges are tonal — a tinted surface with saturated text —
        // rather than a saturated fill with white text. The previous pending
        // badge was `brandingWhite` on `brandingMapYellow` (#ebc300), roughly
        // 1.8:1 contrast, which fails WCAG AA at any size. Tonal badges also
        // pair a dot with the color so status is not signalled by hue alone.
        pactCardStatusBadge: {
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: space.md,
            paddingVertical: space.xs,
            borderRadius: radius.pill,
            alignSelf: 'flex-start',
            marginBottom: space.md,
        },
        pactCardStatusDot: {
            width: 6,
            height: 6,
            borderRadius: radius.circle,
            marginRight: space.sm,
        },
        pactCardStatusActive: {
            backgroundColor: tint(therrTheme.colors.alertSuccess, 0.14),
        },
        pactCardStatusPending: {
            backgroundColor: tint(therrTheme.colors.alertWarning, 0.16),
        },
        pactCardStatusNeutral: {
            backgroundColor: therrTheme.colors.backgroundNeutral,
        },
        pactCardStatusText: {
            fontFamily: therrFontFamily,
            fontSize: fontSizes.xs,
            fontWeight: fontWeights.semibold,
            letterSpacing: 0.3,
        },
        pactCardStatusTextActive: {
            color: therrTheme.colors.alertSuccess,
        },
        pactCardStatusTextPending: {
            color: therrTheme.colors.alertWarning,
        },
        pactCardStatusTextNeutral: {
            color: therrTheme.colors.onSurfaceMuted,
        },
        // Pact Card / detail — renewal lineage.
        //
        // A re-commit creates a new pact on the same habit goal, and the list shows only
        // the newest cycle. These render the edge across that boundary: which cycle a pact
        // continues, and (on a pact reached through that link) which newer cycle continues
        // it. Deliberately quiet — a chip, not a button. The row is a fact about the pact
        // first and a way to navigate second, and it sits above the partner row so it is
        // read as part of the pact's identity rather than as one of its actions.
        pactCardLineageRow: {
            flexDirection: 'row',
            alignItems: 'center',
            alignSelf: 'flex-start',
            marginTop: space.sm,
            paddingVertical: 4,
            paddingHorizontal: space.sm,
            borderRadius: radius.sm,
            backgroundColor: therrTheme.colors.backgroundNeutral,
        },
        pactCardLineageRowPressed: {
            opacity: 0.6,
        },
        pactCardLineageText: {
            fontFamily: therrFontFamily,
            fontSize: fontSizes.xs,
            color: therrTheme.colors.onSurfaceMuted,
            marginHorizontal: 6,
        },
        // The cycle count, shown from the second cycle on. A first cycle badged
        // "cycle 1" is noise; "cycle 3" is the answer to "why have I seen this habit
        // before", which is the question a renewal list raises.
        pactCardCycleBadge: {
            fontFamily: therrFontFamily,
            fontSize: fontSizes.xs,
            fontWeight: fontWeights.semibold,
            color: therrTheme.colors.onSurfaceMuted,
            marginTop: 2,
        },
        // Pact Card — pending invite response actions
        pactCardInvitePrompt: {
            fontFamily: therrFontFamily,
            fontSize: 13,
            color: therrTheme.colors.textGray,
            marginTop: 12,
        },
        pactCardInviteActions: {
            flexDirection: 'row',
            marginTop: space.md,
        },
        // `flex: 1` belongs on the side-by-side variant only. It used to live
        // on the base style, so a stacked button — the Nudge action on a sent
        // invite — inherited it inside a *column* card and stretched to fill
        // all remaining vertical space, leaving a large dead gap mid-card.
        pactCardInviteButton: {
            flexDirection: 'row',
            minHeight: 44,
            borderRadius: radius.md,
            alignItems: 'center',
            justifyContent: 'center',
            paddingHorizontal: space.md,
        },
        pactCardInviteButtonInline: {
            flex: 1,
        },
        pactCardInviteButtonPrimary: {
            backgroundColor: therrTheme.colors.brand,
            marginRight: space.sm,
            ...shadowSm,
        },
        // Full-width variant for cards that stack actions instead of pairing
        // them side by side (sent invites: nudge, then invite someone else).
        pactCardInviteButtonStacked: {
            alignSelf: 'stretch',
            marginRight: 0,
            marginTop: space.md,
        },
        pactCardNudgeSent: {
            flexDirection: 'row',
            alignItems: 'center',
            alignSelf: 'flex-start',
            marginTop: space.md,
            paddingVertical: space.xs,
            paddingHorizontal: space.md,
            borderRadius: radius.pill,
            backgroundColor: tint(therrTheme.colors.alertSuccess, 0.14),
        },
        pactCardNudgeSentText: {
            fontFamily: therrFontFamily,
            fontSize: fontSizes.xs,
            fontWeight: fontWeights.medium,
            color: therrTheme.colors.alertSuccess,
            marginLeft: space.xs,
        },
        pactCardInviteButtonSecondary: {
            borderWidth: 1,
            borderColor: therrTheme.colors.accentDivider,
        },
        pactCardInviteButtonPressed: {
            opacity: 0.75,
        },
        pactCardInviteButtonPrimaryText: {
            fontFamily: therrFontFamily,
            fontSize: fontSizes.sm,
            fontWeight: fontWeights.semibold,
            color: therrTheme.colors.onBrand,
            marginLeft: space.sm,
        },
        pactCardInviteButtonSecondaryText: {
            fontFamily: therrFontFamily,
            fontSize: fontSizes.sm,
            fontWeight: fontWeights.semibold,
            color: therrTheme.colors.onSurfaceMuted,
            marginLeft: space.sm,
        },
        // Decline keeps a destructive tone, but via `alertError` (~5.9:1 on the
        // light surface) rather than `accentRed` (#fe0156, ~3.9:1) which did
        // not clear AA for text at this size.
        pactCardInviteButtonDestructiveText: {
            fontFamily: therrFontFamily,
            fontSize: fontSizes.sm,
            fontWeight: fontWeights.semibold,
            color: therrTheme.colors.alertError,
            marginLeft: space.sm,
        },
        // Tertiary text action (share invite) — no chrome, so it sits clearly
        // below the primary action instead of competing with it.
        pactCardTextAction: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            alignSelf: 'stretch',
            minHeight: 44,
            marginTop: space.xs,
        },
        pactCardTextActionLabel: {
            fontFamily: therrFontFamily,
            fontSize: fontSizes.sm,
            fontWeight: fontWeights.semibold,
            color: therrTheme.colors.brand,
            marginLeft: space.sm,
        },
        pactPartnerRow: {
            flexDirection: 'row',
            alignItems: 'center',
            marginTop: space.md,
            paddingTop: space.md,
            borderTopWidth: StyleSheet.hairlineWidth,
            borderTopColor: therrTheme.colors.accentDivider,
        },
        pactPartnerAvatar: {
            width: 32,
            height: 32,
            borderRadius: radius.circle,
            backgroundColor: tint(therrTheme.colors.brand, 0.14),
            alignItems: 'center',
            justifyContent: 'center',
            marginRight: space.sm,
        },
        // Initials were rendering in the default text color on a dark purple
        // disc; brand-on-tint keeps them legible in every theme.
        pactPartnerAvatarInitial: {
            fontFamily: therrFontFamily,
            fontSize: fontSizes.sm,
            fontWeight: fontWeights.semibold,
            color: therrTheme.colors.brand,
        },
        pactPartnerName: {
            fontFamily: therrFontFamily,
            fontSize: fontSizes.sm,
            fontWeight: fontWeights.medium,
            color: therrTheme.colors.onSurface,
            flexShrink: 1,
        },
        pactComparisonContainer: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-around',
            marginTop: 16,
            paddingTop: 16,
            borderTopWidth: 1,
            borderTopColor: therrTheme.colors.primary4,
        },
        pactComparisonItem: {
            alignItems: 'center',
        },
        pactComparisonItemPressed: {
            opacity: 0.6,
        },
        pactComparisonTodayRow: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 4,
            marginTop: 2,
        },

        // Pact Detail — member list + inline navigation links
        pactMemberRow: {
            flexDirection: 'row',
            alignItems: 'center',
            paddingVertical: 12,
        },
        pactMemberRowDivided: {
            borderTopWidth: 1,
            borderTopColor: therrTheme.colors.primary4,
        },
        // The profile link fills the row; the message button sits outside it so
        // the two tap targets never overlap.
        pactMemberRowLink: {
            flex: 1,
            flexDirection: 'row',
            alignItems: 'center',
        },
        pactMemberDetails: {
            flex: 1,
            marginLeft: 12,
        },
        pactMemberName: {
            fontFamily: therrFontFamily,
            fontSize: 15,
            fontWeight: '600',
            color: therrTheme.colors.onSurface,
        },
        pactMemberMeta: {
            fontFamily: therrFontFamily,
            fontSize: 12,
            color: therrTheme.colors.textGray,
            marginTop: 2,
        },
        // Today's check-in state, rendered per member so a partner's absence is
        // noticeable — the whole mechanism behind the Friend Streak result.
        pactMemberTodayBadge: {
            width: 26,
            height: 26,
            borderRadius: 13,
            alignItems: 'center',
            justifyContent: 'center',
            marginLeft: 4,
        },
        pactMemberTodayBadgeDone: {
            backgroundColor: therrTheme.colorVariations.primary3Fade,
        },
        pactMemberTodayBadgePending: {
            borderWidth: 1,
            borderColor: therrTheme.colors.primary4,
        },
        pactMemberAction: {
            width: 40,
            height: 40,
            borderRadius: 20,
            alignItems: 'center',
            justifyContent: 'center',
            marginLeft: 4,
            backgroundColor: therrTheme.colorVariations.primary3Fade,
        },
        pactLinkRow: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginTop: 12,
            paddingTop: 12,
            borderTopWidth: 1,
            borderTopColor: therrTheme.colors.primary4,
        },
        pactLinkText: {
            fontFamily: therrFontFamily,
            fontSize: 14,
            fontWeight: '600',
            color: therrTheme.colors.primary3,
        },
        pactPressedSurface: {
            opacity: 0.75,
        },
        pactTimelineRow: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginTop: 8,
        },
        pactComparisonValue: {
            fontFamily: therrFontFamily,
            fontSize: 24,
            fontWeight: '700',
            color: therrTheme.colors.onSurface,
        },
        pactComparisonLabel: {
            fontFamily: therrFontFamily,
            fontSize: 12,
            color: therrTheme.colors.textGray,
            marginTop: 4,
        },

        // Dashboard — weekly leaderboard row, top of the progress card
        leaderboardTeaserRow: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: space.md,
        },
        leaderboardTeaserRowPressed: {
            opacity: 0.6,
        },
        leaderboardTeaserIconContainer: {
            width: 36,
            height: 36,
            borderRadius: radius.pill,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: therrTheme.colors.backgroundGray,
        },
        leaderboardTeaserIcon: {
            color: therrTheme.colors.primary3,
        },
        leaderboardTeaserTextContainer: {
            flex: 1,
        },
        leaderboardTeaserTitle: {
            fontFamily: therrFontFamily,
            fontSize: fontSizes.md,
            fontWeight: fontWeights.bold,
            color: therrTheme.colors.onSurface,
        },
        leaderboardTeaserSubtitle: {
            fontFamily: therrFontFamily,
            fontSize: fontSizes.sm,
            color: therrTheme.colors.onSurfaceMuted,
            marginTop: 2,
        },
        leaderboardTeaserChevron: {
            color: therrTheme.colors.onSurfaceMuted,
        },

        // Dashboard
        dashboardContainer: {
            flex: 1,
            backgroundColor: therrTheme.colors.backgroundGray,
        },
        dashboardHeader: {
            paddingHorizontal: space.lg,
            paddingTop: space.lg,
            paddingBottom: space.md,
            backgroundColor: therrTheme.colors.surface,
        },
        dashboardGreeting: {
            fontFamily: therrFontFamily,
            fontSize: fontSizes.xxl,
            lineHeight: fontSizes.xxl * lineHeights.tight,
            fontWeight: fontWeights.bold,
            color: therrTheme.colors.onSurface,
        },
        dashboardSubtitle: {
            fontFamily: therrFontFamily,
            fontSize: fontSizes.sm,
            lineHeight: fontSizes.sm * lineHeights.normal,
            color: therrTheme.colors.onSurfaceMuted,
            marginTop: space.xs,
        },
        dashboardSection: {
            marginTop: space.lg,
        },
        dashboardSectionTitle: {
            fontFamily: therrFontFamily,
            fontSize: fontSizes.sm,
            fontWeight: fontWeights.bold,
            letterSpacing: 0.8,
            textTransform: 'uppercase',
            color: therrTheme.colors.onSurfaceMuted,
            marginHorizontal: space.lg,
            marginBottom: space.sm,
        },

        // Segmented control — the tab row was four cramped text labels with a
        // 2dp underline, left-aligned so the row read as unfinished. A pill
        // segmented control is the current cross-platform convention and gives
        // each segment a real, equally-sized touch target.
        segmentedControl: {
            flexDirection: 'row',
            marginHorizontal: space.lg,
            marginTop: space.md,
            marginBottom: space.sm,
            padding: 3,
            borderRadius: radius.pill,
            backgroundColor: therrTheme.colors.backgroundNeutral,
        },
        segmentedControlItem: {
            flex: 1,
            minHeight: 34,
            alignItems: 'center',
            justifyContent: 'center',
            paddingHorizontal: space.xs,
            borderRadius: radius.pill,
        },
        segmentedControlItemActive: {
            backgroundColor: therrTheme.colors.surface,
            ...shadowSm,
        },
        segmentedControlLabel: {
            fontFamily: therrFontFamily,
            fontSize: fontSizes.sm,
            fontWeight: fontWeights.medium,
            color: therrTheme.colors.onSurfaceMuted,
        },
        segmentedControlLabelActive: {
            color: therrTheme.colors.onSurface,
            fontWeight: fontWeights.semibold,
        },
        // Nested inside the label so the count wraps and truncates with it.
        // Deliberately not a pill: four flex:1 segments leave roughly 80dp of
        // usable width each, which a badge plus a label does not survive.
        segmentedControlCount: {
            color: therrTheme.colors.onSurfaceMuted,
            fontWeight: fontWeights.semibold,
        },

        // ------------------------------------------------------------------
        // My Habits
        // ------------------------------------------------------------------
        //
        // This screen previously carried its own local StyleSheet built around
        // hardcoded `rgba(255,255,255,0.06)` surfaces and `#fff` text. Those
        // values assume a dark background — on the light theme the app actually
        // ships, the cards were white-on-white and the body text was invisible.
        // Everything here resolves through the theme instead.
        myHabitsPageHeader: {
            marginBottom: space.lg,
        },
        myHabitsCard: {
            borderRadius: radius.xl,
            backgroundColor: therrTheme.colors.surface,
            padding: space.lg,
            marginBottom: space.md,
            borderWidth: 1,
            borderColor: therrTheme.colors.accentDivider,
            ...shadowSm,
        },
        myHabitsCardActive: {
            borderColor: therrTheme.colors.brand,
        },
        myHabitsCardHeader: {
            marginBottom: space.md,
            gap: space.sm,
        },
        myHabitsEmoji: {
            fontSize: fontSizes.xxl,
        },
        myHabitsTitle: {
            flex: 1,
            fontFamily: therrFontFamily,
            fontSize: fontSizes.md,
            fontWeight: fontWeights.semibold,
            color: therrTheme.colors.onSurface,
        },
        myHabitsPendingSection: {
            borderTopWidth: StyleSheet.hairlineWidth,
            borderTopColor: therrTheme.colors.accentDivider,
            paddingTop: space.md,
            gap: space.sm,
        },
        myHabitsPendingBadge: {
            alignSelf: 'flex-start',
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: tint(therrTheme.colors.alertWarning, 0.16),
            borderRadius: radius.pill,
            paddingHorizontal: space.md,
            paddingVertical: space.xs,
        },
        myHabitsPendingBadgeText: {
            fontFamily: therrFontFamily,
            fontSize: fontSizes.xs,
            fontWeight: fontWeights.semibold,
            color: therrTheme.colors.alertWarning,
        },
        myHabitsPactRow: {
            gap: space.xs,
        },
        myHabitsTeamRow: {
            flexDirection: 'row',
            flexWrap: 'wrap',
        },
        myHabitsTeamLabel: {
            fontFamily: therrFontFamily,
            fontSize: fontSizes.sm,
            color: therrTheme.colors.onSurfaceMuted,
        },
        myHabitsTeamNames: {
            fontFamily: therrFontFamily,
            fontSize: fontSizes.sm,
            fontWeight: fontWeights.medium,
            color: therrTheme.colors.onSurface,
        },
        myHabitsInvitedTime: {
            fontFamily: therrFontFamily,
            fontSize: fontSizes.xs,
            color: therrTheme.colors.onSurfaceMuted,
        },
        myHabitsTextAction: {
            flexDirection: 'row',
            alignItems: 'center',
            alignSelf: 'flex-start',
            minHeight: 44,
        },
        myHabitsTextActionLabel: {
            fontFamily: therrFontFamily,
            fontSize: fontSizes.sm,
            fontWeight: fontWeights.semibold,
            color: therrTheme.colors.brand,
        },
        myHabitsPactsLink: {
            alignSelf: 'center',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: 44,
            paddingHorizontal: space.md,
            marginTop: space.sm,
        },
        myHabitsEmptyContainer: {
            alignItems: 'center',
            paddingTop: space.xxl,
            gap: space.lg,
        },
        myHabitsEmptyText: {
            fontFamily: therrFontFamily,
            fontSize: fontSizes.md,
            lineHeight: fontSizes.md * lineHeights.normal,
            color: therrTheme.colors.onSurfaceMuted,
            textAlign: 'center',
        },
        myHabitsPrimaryButton: {
            flexDirection: 'row',
            backgroundColor: therrTheme.colors.brand,
            borderRadius: radius.md,
            minHeight: 44,
            paddingHorizontal: space.xl,
            alignItems: 'center',
            justifyContent: 'center',
            ...shadowSm,
        },
        myHabitsPrimaryButtonText: {
            fontFamily: therrFontFamily,
            fontSize: fontSizes.sm,
            fontWeight: fontWeights.semibold,
            color: therrTheme.colors.onBrand,
        },
        pressedOpacity: {
            opacity: 0.75,
        },

        // Clears the floating bottom nav *and* the floating "new pact" action
        // so the last card is fully readable and tappable.
        pactsListContent: {
            paddingTop: space.xs,
            paddingBottom: newPactFabClearance,
        },
        dashboardScrollContent: {
            paddingBottom: newPactFabClearance,
        },

        // Empty state
        emptyStateContainer: {
            paddingHorizontal: space.xl,
            paddingTop: space.xxxl,
            paddingBottom: space.xl,
            alignItems: 'center',
        },
        // A tinted disc behind the glyph keeps the empty state from reading as
        // a stray emoji floating in whitespace.
        emptyStateIconCircle: {
            width: 72,
            height: 72,
            borderRadius: radius.circle,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: tint(therrTheme.colors.brand, 0.10),
            marginBottom: space.lg,
        },
        emptyStateEmoji: {
            fontSize: 32,
        },
        emptyStateTitle: {
            fontFamily: therrFontFamily,
            fontSize: fontSizes.lg,
            fontWeight: fontWeights.semibold,
            color: therrTheme.colors.onSurface,
            textAlign: 'center',
        },
        emptyStateSubtitle: {
            fontFamily: therrFontFamily,
            fontSize: fontSizes.sm,
            lineHeight: fontSizes.sm * lineHeights.normal,
            color: therrTheme.colors.onSurfaceMuted,
            textAlign: 'center',
            marginTop: space.sm,
        },
        // Empty states used to be copy only, which left "how do I start one?"
        // unanswered on the exact screen where the user is asking it.
        emptyStateActionButton: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: 44,
            marginTop: space.lg,
            paddingHorizontal: space.xl,
            borderRadius: radius.md,
            backgroundColor: therrTheme.colors.brand,
            ...shadowSm,
        },
        emptyStateActionLabel: {
            fontFamily: therrFontFamily,
            fontSize: fontSizes.sm,
            fontWeight: fontWeights.semibold,
            color: therrTheme.colors.onBrand,
        },

        // Floating "new pact" action.
        //
        // Creating a pact used to be reachable only from the onboarding
        // overlay — which stops rendering the moment the user has an active
        // pact — and from a link inside the Sent tab's invite card. A user
        // with a live pact therefore had no way to start another one. This
        // sits above the button menu on both the dashboard and the pacts list.
        newPactFabContainer: {
            position: 'absolute',
            right: space.lg,
            bottom: buttonMenuHeight + space.lg,
        },
        newPactFab: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: NEW_PACT_FAB_HEIGHT,
            paddingHorizontal: space.lg,
            borderRadius: radius.pill,
            backgroundColor: therrTheme.colors.brand,
            ...shadowMd,
        },
        newPactFabIcon: {
            color: therrTheme.colors.onBrand,
            marginRight: space.xs,
        },
        newPactFabLabel: {
            fontFamily: therrFontFamily,
            fontSize: fontSizes.sm,
            fontWeight: fontWeights.semibold,
            color: therrTheme.colors.onBrand,
        },

        // Pact onboarding stepper
        //
        // The three states used to be indistinguishable: `stepperCircle` was
        // `primary4` and `stepperCircleActive` was `primary3` — on HABITS both
        // are purple (#5B4273 / #6E5C85), so every step read as reached and the
        // stepper conveyed nothing. States are now genuinely distinct:
        //   done    — filled brand + check glyph
        //   current — brand-tinted surface, brand ring, brand number
        //   upcoming— neutral surface, muted number
        stepperContainer: {
            flexDirection: 'row',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            paddingHorizontal: space.xl,
            paddingTop: space.md,
            paddingBottom: space.lg,
            backgroundColor: therrTheme.colors.surface,
        },
        stepperItem: {
            alignItems: 'center',
            flex: 1,
        },
        stepperConnector: {
            position: 'absolute',
            top: 17,
            left: '50%',
            right: '-50%',
            height: 2,
            backgroundColor: therrTheme.colors.backgroundNeutral,
            zIndex: -1,
        },
        stepperConnectorActive: {
            backgroundColor: therrTheme.colors.brand,
        },
        stepperCircle: {
            width: 36,
            height: 36,
            borderRadius: radius.circle,
            alignItems: 'center',
            justifyContent: 'center',
            borderWidth: 2,
            borderColor: 'transparent',
            backgroundColor: therrTheme.colors.backgroundNeutral,
            marginBottom: space.sm,
        },
        stepperCircleCurrent: {
            backgroundColor: tint(therrTheme.colors.brand, 0.14),
            borderColor: therrTheme.colors.brand,
        },
        stepperCircleDone: {
            backgroundColor: therrTheme.colors.brand,
            borderColor: therrTheme.colors.brand,
        },
        stepperCircleNumber: {
            fontFamily: therrFontFamily,
            fontSize: fontSizes.sm,
            fontWeight: fontWeights.bold,
            color: therrTheme.colors.onSurfaceMuted,
        },
        stepperCircleNumberCurrent: {
            color: therrTheme.colors.brand,
        },
        stepperLabel: {
            fontFamily: therrFontFamily,
            fontSize: fontSizes.xs,
            fontWeight: fontWeights.medium,
            color: therrTheme.colors.onSurfaceMuted,
            textAlign: 'center',
        },
        stepperLabelActive: {
            color: therrTheme.colors.onSurface,
            fontWeight: fontWeights.semibold,
        },
        stepperSublabel: {
            fontFamily: therrFontFamily,
            fontSize: fontSizes.xs,
            color: therrTheme.colors.onSurfaceMuted,
            textAlign: 'center',
            marginTop: 2,
        },

        // Onboarding cards
        //
        // The separate "Step N of 3" badge above each card duplicated the
        // stepper directly above it. The step index now lives inside the card
        // header as a small numbered disc, which ties the number to the content
        // it describes instead of repeating the stepper twice on one screen.
        onboardingCardStepIndex: {
            width: 22,
            height: 22,
            borderRadius: radius.circle,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: tint(therrTheme.colors.brand, 0.14),
            marginRight: space.sm,
        },
        onboardingCardStepIndexDone: {
            backgroundColor: therrTheme.colors.brand,
        },
        onboardingCardStepIndexText: {
            fontFamily: therrFontFamily,
            fontSize: 11,
            fontWeight: fontWeights.bold,
            color: therrTheme.colors.brand,
        },
        onboardingCardStepIndexTextDone: {
            color: therrTheme.colors.onBrand,
        },
        onboardingCardHeaderRow: {
            flexDirection: 'row',
            alignItems: 'center',
            marginBottom: space.sm,
        },
        onboardingCardHeader: {
            fontFamily: therrFontFamily,
            fontSize: fontSizes.xs,
            fontWeight: fontWeights.bold,
            color: therrTheme.colors.brand,
            textTransform: 'uppercase',
            letterSpacing: 0.6,
            flexShrink: 1,
        },
        onboardingCardTitle: {
            fontFamily: therrFontFamily,
            fontSize: fontSizes.lg,
            fontWeight: fontWeights.semibold,
            color: therrTheme.colors.onSurface,
            marginBottom: space.xs,
        },
        onboardingCardBody: {
            fontFamily: therrFontFamily,
            fontSize: fontSizes.sm,
            lineHeight: fontSizes.sm * lineHeights.normal,
            color: therrTheme.colors.onSurfaceMuted,
        },
        onboardingCardFooter: {
            fontFamily: therrFontFamily,
            fontSize: fontSizes.xs,
            color: therrTheme.colors.onSurfaceMuted,
            marginTop: space.md,
            paddingTop: space.md,
            borderTopWidth: StyleSheet.hairlineWidth,
            borderTopColor: therrTheme.colors.accentDivider,
        },
        onboardingCardLeading: {
            width: 40,
            height: 40,
            borderRadius: radius.circle,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: tint(therrTheme.colors.brand, 0.10),
            marginRight: space.md,
        },
        onboardingCardLeadingGlyph: {
            fontSize: 20,
        },

        // Sticky onboarding footer
        onboardingFooter: {
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            backgroundColor: therrTheme.colors.surface,
            borderTopLeftRadius: radius.xl,
            borderTopRightRadius: radius.xl,
            borderTopWidth: StyleSheet.hairlineWidth,
            borderTopColor: therrTheme.colors.accentDivider,
            paddingTop: space.lg,
            paddingHorizontal: space.lg,
        },
        onboardingFooterHelper: {
            fontFamily: therrFontFamily,
            fontSize: fontSizes.xs,
            color: therrTheme.colors.onSurfaceMuted,
            textAlign: 'center',
            marginBottom: space.md,
        },
        onboardingFooterSecondary: {
            minHeight: 44,
            alignItems: 'center',
            justifyContent: 'center',
            marginTop: space.xs,
        },
        onboardingFooterSecondaryText: {
            fontFamily: therrFontFamily,
            fontSize: fontSizes.sm,
            fontWeight: fontWeights.semibold,
            color: therrTheme.colors.brand,
        },

        // Check-in detail screen (the note/photo form that replaced the bottom sheet).
        formHabitName: {
            fontFamily: therrFontFamily,
            fontSize: fontSizes.md,
            fontWeight: fontWeights.bold,
            color: therrTheme.colors.textWhite,
            paddingHorizontal: 10,
        },
        formPrompt: {
            fontFamily: therrFontFamily,
            fontSize: fontSizes.sm,
            color: therrTheme.colors.textWhite,
            opacity: 0.8,
            paddingHorizontal: 10,
            paddingTop: 4,
            paddingBottom: 12,
        },
        formBodyText: {
            fontFamily: therrFontFamily,
            fontSize: fontSizes.sm,
            color: therrTheme.colors.textWhite,
        },
        formBodyTextBold: {
            fontFamily: therrFontFamily,
            fontSize: fontSizes.sm,
            fontWeight: fontWeights.semibold,
            color: therrTheme.colors.textWhite,
        },

        // ------------------------------------------------------------------
        // Weekly recap (routes/WeeklyRecap)
        //
        // Every colour here resolves through the theme. The day strip is the
        // one place that needs a fixed relationship between two of them: a
        // "frozen" day has to read as *different from* an upheld day and *not
        // worse than* a missed one, since the streak survived it. Upheld is the
        // brand fill, frozen is a brand-tinted outline, missed is a bare
        // divider-coloured outline — three states distinguishable by shape as
        // well as by colour, so the strip still parses without colour vision.
        // ------------------------------------------------------------------
        weeklyRecapContainer: {
            backgroundColor: therrTheme.colors.backgroundNeutral,
            flex: 1,
        },
        weeklyRecapHeader: {
            paddingHorizontal: space.lg,
            paddingTop: space.lg,
            paddingBottom: space.md,
        },
        weeklyRecapHeadline: {
            fontFamily: therrFontFamily,
            fontSize: fontSizes.xl,
            fontWeight: fontWeights.bold,
            lineHeight: fontSizes.xl * lineHeights.tight,
            color: therrTheme.colors.onSurface,
        },
        weeklyRecapDateRange: {
            fontFamily: therrFontFamily,
            fontSize: fontSizes.sm,
            color: therrTheme.colors.textGray,
            marginTop: space.xs,
        },
        weeklyRecapCard: {
            borderRadius: radius.xl,
            backgroundColor: therrTheme.colors.surface,
            padding: space.lg,
            marginHorizontal: space.lg,
            marginBottom: space.md,
            borderWidth: 1,
            borderColor: therrTheme.colors.accentDivider,
            ...shadowSm,
        },
        weeklyRecapCardTitle: {
            fontFamily: therrFontFamily,
            fontSize: fontSizes.xs,
            fontWeight: fontWeights.semibold,
            letterSpacing: 0.6,
            textTransform: 'uppercase',
            color: therrTheme.colors.textGray,
            marginBottom: space.md,
        },
        weeklyRecapStrip: {
            flexDirection: 'row',
            justifyContent: 'space-between',
        },
        weeklyRecapDay: {
            alignItems: 'center',
            flex: 1,
            gap: space.xs,
        },
        weeklyRecapDayLabel: {
            fontFamily: therrFontFamily,
            fontSize: fontSizes.xs,
            color: therrTheme.colors.textGray,
        },
        weeklyRecapDayDot: {
            width: 32,
            height: 32,
            borderRadius: radius.pill,
            alignItems: 'center',
            justifyContent: 'center',
            borderWidth: 2,
            borderColor: therrTheme.colors.accentDivider,
            backgroundColor: 'transparent',
        },
        weeklyRecapDayDotUpheld: {
            backgroundColor: therrTheme.colors.brand,
            borderColor: therrTheme.colors.brand,
        },
        weeklyRecapDayDotFrozen: {
            backgroundColor: tint(therrTheme.colors.brand, 0.16),
            borderColor: therrTheme.colors.brand,
        },
        // On a brand-filled dot, so `onBrand` rather than any of the surface
        // text colours — `textWhite` is #363636 on the light theme and would
        // render dark-on-dark here.
        weeklyRecapDayCount: {
            fontFamily: therrFontFamily,
            fontSize: fontSizes.xs,
            fontWeight: fontWeights.semibold,
            color: therrTheme.colors.onBrand,
        },
        weeklyRecapDayCountMuted: {
            fontFamily: therrFontFamily,
            fontSize: fontSizes.xs,
            fontWeight: fontWeights.semibold,
            color: therrTheme.colors.onSurface,
        },
        weeklyRecapStatRow: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            gap: space.md,
        },
        weeklyRecapStat: {
            flex: 1,
            alignItems: 'center',
        },
        weeklyRecapStatValue: {
            fontFamily: therrFontFamily,
            fontSize: fontSizes.xl,
            fontWeight: fontWeights.bold,
            color: therrTheme.colors.onSurface,
        },
        weeklyRecapStatLabel: {
            fontFamily: therrFontFamily,
            fontSize: fontSizes.xs,
            color: therrTheme.colors.textGray,
            textAlign: 'center',
            marginTop: space.xs,
        },
        weeklyRecapDelta: {
            fontFamily: therrFontFamily,
            fontSize: fontSizes.xs,
            fontWeight: fontWeights.semibold,
            marginTop: space.xs,
        },
        weeklyRecapDeltaUp: {
            color: therrTheme.colors.alertSuccess,
        },
        weeklyRecapDeltaDown: {
            color: therrTheme.colors.alertWarning,
        },
        weeklyRecapHabitRow: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: space.sm,
            paddingVertical: space.sm,
            borderTopWidth: StyleSheet.hairlineWidth,
            borderTopColor: therrTheme.colors.accentDivider,
        },
        weeklyRecapHabitRowFirst: {
            borderTopWidth: 0,
        },
        weeklyRecapHabitEmoji: {
            fontSize: fontSizes.lg,
        },
        weeklyRecapHabitName: {
            flex: 1,
            fontFamily: therrFontFamily,
            fontSize: fontSizes.sm,
            color: therrTheme.colors.onSurface,
        },
        weeklyRecapHabitCount: {
            fontFamily: therrFontFamily,
            fontSize: fontSizes.sm,
            fontWeight: fontWeights.semibold,
            color: therrTheme.colors.onSurface,
        },
        weeklyRecapEmptyText: {
            fontFamily: therrFontFamily,
            fontSize: fontSizes.sm,
            color: therrTheme.colors.textGray,
            textAlign: 'center',
        },
        weeklyRecapNavRow: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            paddingHorizontal: space.lg,
            paddingBottom: space.md,
            gap: space.md,
        },
        weeklyRecapNavButton: {
            paddingVertical: space.sm,
            paddingHorizontal: space.md,
            borderRadius: radius.pill,
            borderWidth: 1,
            borderColor: therrTheme.colors.accentDivider,
            backgroundColor: therrTheme.colors.surface,
        },
        weeklyRecapNavButtonDisabled: {
            opacity: 0.4,
        },
        weeklyRecapNavButtonText: {
            fontFamily: therrFontFamily,
            fontSize: fontSizes.xs,
            fontWeight: fontWeights.semibold,
            color: therrTheme.colors.brand,
        },

        // Upgrade paywall
        //
        // The screen used to be a stack of body-copy lines and two identical
        // brand-coloured buttons — "Unlock for life" and "Not now" carried the
        // same weight, so the exit competed with the purchase. The founder offer
        // is now one hero card on a brand gradient (white ink, gold accents, a
        // white CTA that is the brightest thing on screen); the monthly plan is
        // a quieter outlined card that exists mostly to anchor the price; and
        // "Not now" is a text link. Every colour still comes from the theme so
        // the Therr and Habits palettes both render correctly.
        paywallScrollContent: {
            paddingBottom: space.xxxl,
        },
        paywallHeader: {
            paddingHorizontal: space.lg,
            paddingTop: space.lg,
            paddingBottom: space.lg,
            backgroundColor: therrTheme.colors.surface,
        },
        // A row of filled pips, one per free slot, so "you have reached your
        // limit" is something the user can see rather than only read.
        paywallLimitMeter: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: space.xs,
            marginBottom: space.sm,
        },
        paywallLimitPip: {
            width: 28,
            height: 8,
            borderRadius: radius.pill,
            backgroundColor: therrTheme.colors.brand,
        },
        paywallLimitMeterLabel: {
            fontFamily: therrFontFamily,
            fontSize: fontSizes.xs,
            fontWeight: fontWeights.semibold,
            letterSpacing: 0.6,
            textTransform: 'uppercase',
            color: therrTheme.colors.onSurfaceMuted,
            marginLeft: space.xs,
        },
        paywallHeroCard: {
            marginHorizontal: space.lg,
            marginTop: space.lg,
            borderRadius: radius.xl,
            padding: space.xl,
            overflow: 'hidden',
            ...shadowMd,
        },
        paywallEyebrowRow: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
        },
        paywallEyebrowChip: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: space.xs,
            paddingVertical: space.xs,
            paddingHorizontal: space.sm + 2,
            borderRadius: radius.pill,
            backgroundColor: tint(BRAND_WHITE, 0.18),
        },
        paywallEyebrowText: {
            fontFamily: therrFontFamily,
            fontSize: fontSizes.xs,
            fontWeight: fontWeights.bold,
            letterSpacing: 1,
            textTransform: 'uppercase',
            color: BRAND_WHITE,
        },
        paywallEyebrowIcon: {
            color: therrTheme.colors.accent,
        },
        paywallEyebrowAside: {
            fontFamily: therrFontFamily,
            fontSize: fontSizes.xs,
            fontWeight: fontWeights.semibold,
            color: tint(BRAND_WHITE, 0.85),
        },
        paywallPriceRow: {
            flexDirection: 'row',
            alignItems: 'flex-end',
            flexWrap: 'wrap',
            gap: space.sm,
            marginTop: space.lg,
        },
        paywallPrice: {
            fontFamily: therrFontFamily,
            fontSize: 40,
            lineHeight: 44,
            fontWeight: '800',
            letterSpacing: -0.5,
            color: BRAND_WHITE,
        },
        paywallPriceCaption: {
            fontFamily: therrFontFamily,
            fontSize: fontSizes.sm,
            lineHeight: fontSizes.sm * lineHeights.normal,
            color: tint(BRAND_WHITE, 0.85),
            paddingBottom: 6,
        },
        paywallHeroSubtitle: {
            fontFamily: therrFontFamily,
            fontSize: fontSizes.md,
            lineHeight: fontSizes.md * lineHeights.normal,
            fontWeight: fontWeights.semibold,
            color: BRAND_WHITE,
            marginTop: space.md,
        },
        paywallBenefitList: {
            marginTop: space.md,
            gap: space.sm,
        },
        paywallBenefitRow: {
            flexDirection: 'row',
            alignItems: 'flex-start',
            gap: space.sm + 2,
        },
        paywallBenefitIcon: {
            color: therrTheme.colors.accent,
            marginTop: 2,
        },
        paywallBenefitText: {
            flex: 1,
            fontFamily: therrFontFamily,
            fontSize: fontSizes.md,
            lineHeight: fontSizes.md * lineHeights.normal,
            color: BRAND_WHITE,
        },
        // Seat meter. The fill is the claimed share, so an offer nobody has
        // bought yet reads as an empty bar — which is honest, and the same
        // reason the numbers come from the server.
        paywallSeatTrack: {
            height: 6,
            borderRadius: radius.pill,
            backgroundColor: tint(BRAND_WHITE, 0.25),
            marginTop: space.xl,
            overflow: 'hidden',
        },
        paywallSeatFill: {
            height: 6,
            borderRadius: radius.pill,
            backgroundColor: therrTheme.colors.accent,
        },
        paywallSeatCaption: {
            fontFamily: therrFontFamily,
            fontSize: fontSizes.xs,
            fontWeight: fontWeights.semibold,
            color: tint(BRAND_WHITE, 0.9),
            marginTop: space.sm,
        },
        paywallHeroCta: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: 52,
            marginTop: space.lg,
            paddingHorizontal: space.xl,
            borderRadius: radius.lg,
            backgroundColor: BRAND_WHITE,
            ...shadowSm,
        },
        paywallCtaSpinner: {
            marginRight: space.sm,
        },
        paywallHeroCtaText: {
            fontFamily: therrFontFamily,
            fontSize: fontSizes.md,
            fontWeight: fontWeights.bold,
            color: therrTheme.colors.brandDark,
        },
        paywallHeroFootnote: {
            fontFamily: therrFontFamily,
            fontSize: fontSizes.xs,
            lineHeight: fontSizes.xs * lineHeights.normal,
            color: tint(BRAND_WHITE, 0.75),
            textAlign: 'center',
            marginTop: space.md,
        },
        paywallDividerRow: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: space.md,
            marginHorizontal: space.lg,
            marginTop: space.xl,
            marginBottom: space.md,
        },
        paywallDividerLine: {
            flex: 1,
            height: StyleSheet.hairlineWidth,
            backgroundColor: therrTheme.colors.accentDivider,
        },
        paywallDividerText: {
            fontFamily: therrFontFamily,
            fontSize: fontSizes.xs,
            fontWeight: fontWeights.semibold,
            letterSpacing: 0.8,
            textTransform: 'uppercase',
            color: therrTheme.colors.onSurfaceMuted,
        },
        paywallPlanCard: {
            marginHorizontal: space.lg,
            padding: space.lg,
            borderRadius: radius.lg,
            borderWidth: 1,
            borderColor: therrTheme.colors.accentDivider,
            backgroundColor: therrTheme.colors.surface,
        },
        // With no founder card above it there is no divider either, so the
        // plan card supplies its own top margin.
        paywallPlanCardStandalone: {
            marginTop: space.lg,
        },
        paywallPlanHeader: {
            flexDirection: 'row',
            alignItems: 'flex-end',
            justifyContent: 'space-between',
            gap: space.md,
        },
        paywallPlanName: {
            fontFamily: therrFontFamily,
            fontSize: fontSizes.lg,
            fontWeight: fontWeights.bold,
            color: therrTheme.colors.onSurface,
        },
        paywallPlanPriceRow: {
            flexDirection: 'row',
            alignItems: 'baseline',
            gap: space.xs,
        },
        paywallPlanPrice: {
            fontFamily: therrFontFamily,
            fontSize: fontSizes.xl,
            fontWeight: fontWeights.bold,
            color: therrTheme.colors.onSurface,
        },
        paywallPlanPriceSuffix: {
            fontFamily: therrFontFamily,
            fontSize: fontSizes.sm,
            color: therrTheme.colors.onSurfaceMuted,
        },
        paywallPlanSubtitle: {
            fontFamily: therrFontFamily,
            fontSize: fontSizes.sm,
            lineHeight: fontSizes.sm * lineHeights.normal,
            color: therrTheme.colors.onSurfaceMuted,
            marginTop: space.xs,
        },
        paywallPlanBenefitIcon: {
            color: therrTheme.colors.brand,
            marginTop: 2,
        },
        paywallPlanBenefitText: {
            flex: 1,
            fontFamily: therrFontFamily,
            fontSize: fontSizes.sm,
            lineHeight: fontSizes.sm * lineHeights.normal,
            color: therrTheme.colors.onSurface,
        },
        paywallSecondaryCta: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: 48,
            marginTop: space.lg,
            paddingHorizontal: space.xl,
            borderRadius: radius.lg,
            borderWidth: 1.5,
            borderColor: therrTheme.colors.brand,
        },
        paywallSecondaryCtaText: {
            fontFamily: therrFontFamily,
            fontSize: fontSizes.sm,
            fontWeight: fontWeights.bold,
            color: therrTheme.colors.brand,
        },
        // When the founder offer is sold out the monthly plan is the only thing
        // for sale, so its button takes the primary fill.
        paywallSecondaryCtaFilled: {
            backgroundColor: therrTheme.colors.brand,
            borderColor: therrTheme.colors.brand,
            ...shadowSm,
        },
        paywallSecondaryCtaTextFilled: {
            color: therrTheme.colors.onBrand,
        },
        paywallPlanFootnote: {
            fontFamily: therrFontFamily,
            fontSize: fontSizes.xs,
            lineHeight: fontSizes.xs * lineHeights.normal,
            color: therrTheme.colors.onSurfaceMuted,
            textAlign: 'center',
            marginTop: space.md,
        },
        paywallTextLink: {
            alignSelf: 'center',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: 44,
            paddingHorizontal: space.lg,
            marginTop: space.lg,
        },
        paywallTextLinkLabel: {
            fontFamily: therrFontFamily,
            fontSize: fontSizes.sm,
            fontWeight: fontWeights.semibold,
            color: therrTheme.colors.onSurfaceMuted,
        },
        // The "already yours" and "nothing to buy here" states share one
        // centred card.
        paywallStatusCard: {
            marginHorizontal: space.lg,
            marginTop: space.lg,
            padding: space.xl,
            borderRadius: radius.lg,
            backgroundColor: therrTheme.colors.surface,
            alignItems: 'center',
            gap: space.md,
        },
        paywallStatusIconCircle: {
            width: 64,
            height: 64,
            borderRadius: radius.circle,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: tint(therrTheme.colors.brand, 0.12),
        },
        paywallStatusIcon: {
            color: therrTheme.colors.brand,
        },
        paywallStatusTitle: {
            fontFamily: therrFontFamily,
            fontSize: fontSizes.xl,
            fontWeight: fontWeights.bold,
            color: therrTheme.colors.onSurface,
            textAlign: 'center',
        },
        paywallStatusBody: {
            fontFamily: therrFontFamily,
            fontSize: fontSizes.sm,
            lineHeight: fontSizes.sm * lineHeights.normal,
            color: therrTheme.colors.onSurfaceMuted,
            textAlign: 'center',
        },
        paywallLoading: {
            paddingVertical: space.xxxl,
            alignItems: 'center',
        },
    });

    return ({
        ...therrTheme,
        styles,
        // Diagonal brand wash behind the founder card. Ends on a lighter tint so
        // the card has depth without a second colour that would fight the gold.
        paywallHeroGradientColors: [
            therrTheme.colors.brandDark,
            therrTheme.colors.brand,
            new Color(therrTheme.colors.brand).lighten(0.12).hex(),
        ],
    });
};

export {
    buildStyles,
};
