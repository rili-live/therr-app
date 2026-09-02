import { StyleSheet } from 'react-native';
import Color from 'color';
import { IMobileThemeName } from 'therr-react/types';
import { therrFontFamily } from '../font';
import { fontSizes, fontWeights, lineHeights } from '../text';
import { space } from '../layouts/spacing';
import { radius } from '../radii';
import { shadowMd, shadowSm } from '../elevation';
import { buttonMenuHeight } from '../navigation/buttonMenu';
import { getTheme, ITherrTheme } from '../themes';

const tint = (color: string, alpha: number) => new Color(color).alpha(alpha).string();

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
        streakProgressBar: {
            height: 8,
            borderRadius: 4,
            backgroundColor: therrTheme.colors.primary4,
            overflow: 'hidden',
        },
        streakProgressFill: {
            height: '100%',
            borderRadius: 4,
            backgroundColor: therrTheme.colors.primary3,
        },
        streakProgressText: {
            fontFamily: therrFontFamily,
            fontSize: 12,
            color: therrTheme.colors.textGray,
            marginTop: 4,
            textAlign: 'right',
        },
        streakMilestoneText: {
            fontFamily: therrFontFamily,
            fontSize: 12,
            color: therrTheme.colors.textGray,
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
            color: therrTheme.colors.textGray,
            flexShrink: 1,
        },

        // Habit Card
        habitCardContainer: {
            backgroundColor: therrTheme.colors.surface,
            borderRadius: radius.xl,
            padding: space.lg,
            marginHorizontal: space.lg,
            marginVertical: space.sm,
            ...shadowSm,
        },
        habitCardHeader: {
            flexDirection: 'row',
            alignItems: 'center',
            marginBottom: space.md,
        },
        habitCardEmoji: {
            fontSize: 32,
            marginRight: space.md,
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
            marginTop: 8,
        },
        habitCardFooter: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginTop: 16,
            paddingTop: 12,
            borderTopWidth: 1,
            borderTopColor: therrTheme.colors.primary4,
        },
        habitCardPartnerText: {
            fontFamily: therrFontFamily,
            fontSize: 13,
            color: therrTheme.colors.textGray,
            marginTop: 8,
        },
        habitCardAwaitingText: {
            fontFamily: therrFontFamily,
            fontSize: 13,
            fontStyle: 'italic',
            color: therrTheme.colors.textGray,
            marginTop: 16,
            paddingTop: 12,
            borderTopWidth: 1,
            borderTopColor: therrTheme.colors.primary4,
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
    });

    return ({
        ...therrTheme,
        styles,
    });
};

export {
    buildStyles,
};
