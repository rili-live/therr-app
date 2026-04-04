import { StyleSheet } from 'react-native';
import { IMobileThemeName } from 'therr-react/types';
import { therrFontFamily } from '../font';
import { getTheme, ITherrTheme } from '../themes';

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
            backgroundColor: therrTheme.colors.brandingWhite,
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
        },
        streakWidgetTitle: {
            fontFamily: therrFontFamily,
            fontSize: 16,
            fontWeight: '600',
            color: therrTheme.colors.textBlack,
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

        // Habit Card
        habitCardContainer: {
            backgroundColor: therrTheme.colors.brandingWhite,
            borderRadius: 16,
            padding: 16,
            marginHorizontal: 16,
            marginVertical: 8,
            shadowColor: therrTheme.colors.textBlack,
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.1,
            shadowRadius: 4,
            elevation: 2,
        },
        habitCardHeader: {
            flexDirection: 'row',
            alignItems: 'center',
            marginBottom: 12,
        },
        habitCardEmoji: {
            fontSize: 32,
            marginRight: 12,
        },
        habitCardTitleContainer: {
            flex: 1,
        },
        habitCardTitle: {
            fontFamily: therrFontFamily,
            fontSize: 18,
            fontWeight: '600',
            color: therrTheme.colors.textBlack,
        },
        habitCardSubtitle: {
            fontFamily: therrFontFamily,
            fontSize: 14,
            color: therrTheme.colors.textGray,
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

        // Calendar
        calendarContainer: {
            backgroundColor: therrTheme.colors.brandingWhite,
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
            color: therrTheme.colors.textBlack,
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
        calendarDayText: {
            fontFamily: therrFontFamily,
            fontSize: 14,
            color: therrTheme.colors.textBlack,
        },
        calendarDayTextCompleted: {
            color: therrTheme.colors.brandingWhite,
        },

        // Pact Card
        pactCardContainer: {
            backgroundColor: therrTheme.colors.brandingWhite,
            borderRadius: 16,
            padding: 16,
            marginHorizontal: 16,
            marginVertical: 8,
            shadowColor: therrTheme.colors.textBlack,
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.1,
            shadowRadius: 4,
            elevation: 2,
        },
        pactCardStatusBadge: {
            paddingHorizontal: 12,
            paddingVertical: 4,
            borderRadius: 12,
            alignSelf: 'flex-start',
            marginBottom: 8,
        },
        pactCardStatusActive: {
            backgroundColor: therrTheme.colors.brandingBlueGreen,
        },
        pactCardStatusPending: {
            backgroundColor: therrTheme.colors.brandingMapYellow,
        },
        pactCardStatusText: {
            fontFamily: therrFontFamily,
            fontSize: 12,
            fontWeight: '600',
            color: therrTheme.colors.brandingWhite,
        },
        pactPartnerRow: {
            flexDirection: 'row',
            alignItems: 'center',
            marginTop: 12,
        },
        pactPartnerAvatar: {
            width: 40,
            height: 40,
            borderRadius: 20,
            backgroundColor: therrTheme.colors.primary4,
            alignItems: 'center',
            justifyContent: 'center',
            marginRight: 12,
        },
        pactPartnerName: {
            fontFamily: therrFontFamily,
            fontSize: 14,
            fontWeight: '500',
            color: therrTheme.colors.textBlack,
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
        pactComparisonValue: {
            fontFamily: therrFontFamily,
            fontSize: 24,
            fontWeight: '700',
            color: therrTheme.colors.textBlack,
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
            padding: 20,
            backgroundColor: therrTheme.colors.brandingWhite,
        },
        dashboardGreeting: {
            fontFamily: therrFontFamily,
            fontSize: 24,
            fontWeight: '700',
            color: therrTheme.colors.textBlack,
        },
        dashboardSubtitle: {
            fontFamily: therrFontFamily,
            fontSize: 16,
            color: therrTheme.colors.textGray,
            marginTop: 4,
        },
        dashboardSection: {
            marginTop: 16,
        },
        dashboardSectionTitle: {
            fontFamily: therrFontFamily,
            fontSize: 18,
            fontWeight: '600',
            color: therrTheme.colors.textBlack,
            marginHorizontal: 16,
            marginBottom: 8,
        },

        // Empty state
        emptyStateContainer: {
            padding: 32,
            alignItems: 'center',
        },
        emptyStateEmoji: {
            fontSize: 48,
            marginBottom: 16,
        },
        emptyStateTitle: {
            fontFamily: therrFontFamily,
            fontSize: 18,
            fontWeight: '600',
            color: therrTheme.colors.textBlack,
            textAlign: 'center',
        },
        emptyStateSubtitle: {
            fontFamily: therrFontFamily,
            fontSize: 14,
            color: therrTheme.colors.textGray,
            textAlign: 'center',
            marginTop: 8,
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
