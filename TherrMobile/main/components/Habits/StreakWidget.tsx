import React from 'react';
import { View, Text } from 'react-native';
import { IStreak } from 'therr-react/types';
import { ITherrThemeColors } from '../../styles/themes';

interface IStreakWidgetProps {
    streak: IStreak;
    title?: string;
    themeHabits: {
        colors: ITherrThemeColors;
        styles: any;
    };
}

const MILESTONES = [3, 7, 14, 30, 60, 90, 180, 365];

const getNextMilestone = (currentStreak: number): number | null => {
    const next = MILESTONES.find((m) => m > currentStreak);
    return next || null;
};

const getStreakEmoji = (currentStreak: number): string => {
    if (currentStreak >= 365) {return '\uD83C\uDFC6';} // trophy
    if (currentStreak >= 180) {return '\uD83D\uDC8E';} // gem
    if (currentStreak >= 90) {return '\u2B50';} // star
    if (currentStreak >= 60) {return '\uD83D\uDD25';} // fire
    if (currentStreak >= 30) {return '\uD83D\uDCAA';} // muscle
    if (currentStreak >= 14) {return '\uD83C\uDF1F';} // glowing star
    if (currentStreak >= 7) {return '\u2728';} // sparkles
    if (currentStreak >= 3) {return '\uD83D\uDE80';} // rocket
    return '\uD83C\uDF31'; // seedling
};

const StreakWidget: React.FC<IStreakWidgetProps> = ({
    streak,
    title = 'Current Streak',
    themeHabits,
}) => {
    const nextMilestone = getNextMilestone(streak.currentStreak);
    const progress = nextMilestone
        ? (streak.currentStreak / nextMilestone) * 100
        : 100;
    const emoji = streak.emoji || getStreakEmoji(streak.currentStreak);

    const getRiskBadgeStyle = () => {
        switch (streak.riskLevel) {
            case 'safe':
                return themeHabits.styles.streakBadgeSafe;
            case 'at_risk':
                return themeHabits.styles.streakBadgeAtRisk;
            case 'critical':
                return themeHabits.styles.streakBadgeCritical;
            default:
                return themeHabits.styles.streakBadge;
        }
    };

    return (
        <View style={themeHabits.styles.streakWidgetContainer}>
            <View style={themeHabits.styles.streakWidgetHeader}>
                <Text style={themeHabits.styles.streakWidgetTitle}>{title}</Text>
                <View style={[themeHabits.styles.streakBadge, getRiskBadgeStyle()]}>
                    <Text style={themeHabits.styles.streakBadgeEmoji}>{emoji}</Text>
                    <Text style={themeHabits.styles.streakBadgeText}>
                        {streak.currentStreak} {streak.currentStreak === 1 ? 'day' : 'days'}
                    </Text>
                </View>
            </View>

            {nextMilestone && (
                <View style={themeHabits.styles.streakProgressContainer}>
                    <View style={themeHabits.styles.streakProgressBar}>
                        <View
                            style={[
                                themeHabits.styles.streakProgressFill,
                                { width: `${Math.min(progress, 100)}%` },
                            ]}
                        />
                    </View>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                        <Text style={themeHabits.styles.streakMilestoneText}>
                            Next milestone: {nextMilestone} days
                        </Text>
                        <Text style={themeHabits.styles.streakProgressText}>
                            {streak.currentStreak}/{nextMilestone}
                        </Text>
                    </View>
                </View>
            )}

            {streak.gracePeriodDays > 0 && streak.graceDaysUsed < streak.gracePeriodDays && (
                <Text style={[themeHabits.styles.streakMilestoneText, { marginTop: 8 }]}>
                    Grace days remaining: {streak.gracePeriodDays - streak.graceDaysUsed}
                </Text>
            )}
        </View>
    );
};

export default StreakWidget;
