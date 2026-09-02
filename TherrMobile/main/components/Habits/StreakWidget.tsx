import React from 'react';
import { View, Text } from 'react-native';
import { IStreak } from 'therr-react/types';
import { ITherrThemeColors } from '../../styles/themes';

interface IStreakWidgetProps {
    streak: IStreak;
    title?: string;
    /**
     * Collapses the widget into two rows (title + badge, then the progress bar with
     * its milestone/grace summary inline). Used where the widget shares the viewport
     * with scrollable content below it, such as the profile header.
     */
    compact?: boolean;
    themeHabits: {
        colors: ITherrThemeColors;
        styles: any;
    };
    translate: (key: string, params?: any) => string;
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
    title,
    compact = false,
    themeHabits,
    translate,
}) => {
    const resolvedTitle = title ?? translate('pages.habits.currentStreak');
    const nextMilestone = getNextMilestone(streak.currentStreak);
    const progress = nextMilestone
        ? (streak.currentStreak / nextMilestone) * 100
        : 100;
    const emoji = streak.emoji || getStreakEmoji(streak.currentStreak);
    const graceDaysRemaining = streak.gracePeriodDays - streak.graceDaysUsed;
    // Rendered whether or not any are left. The count only means something
    // alongside the rule it belongs to, and the moment the user most needs to
    // know the net is gone is exactly the moment the old condition hid the line.
    const hasFreezeAllowance = streak.gracePeriodDays > 0;
    const hasGraceDays = hasFreezeAllowance && graceDaysRemaining > 0;

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

    const badge = (
        <View style={[
            themeHabits.styles.streakBadge,
            getRiskBadgeStyle(),
            compact && themeHabits.styles.streakBadgeCompact,
        ]}>
            <Text style={[
                themeHabits.styles.streakBadgeEmoji,
                compact && themeHabits.styles.streakBadgeEmojiCompact,
            ]}>{emoji}</Text>
            <Text style={[
                themeHabits.styles.streakBadgeText,
                compact && themeHabits.styles.streakBadgeTextCompact,
            ]}>
                {streak.currentStreak}{' '}
                {translate(
                    streak.currentStreak === 1
                        ? 'pages.habits.streak.day'
                        : 'pages.habits.streak.days',
                )}
            </Text>
        </View>
    );

    if (compact) {
        // Milestone and grace days collapse onto a single abbreviated line beside
        // the progress bar so the whole widget stays two rows tall.
        const metaParts: string[] = [];
        if (nextMilestone) {
            metaParts.push(`${streak.currentStreak}/${nextMilestone}`);
            metaParts.push(translate('pages.habits.streak.nextMilestoneCompact', { days: nextMilestone }));
        }
        if (hasGraceDays) {
            metaParts.push(translate('pages.habits.streak.graceDaysCompact', { count: graceDaysRemaining }));
        }

        return (
            <View style={themeHabits.styles.streakWidgetContainerCompact}>
                <View style={themeHabits.styles.streakWidgetHeaderCompact}>
                    <Text style={[
                        themeHabits.styles.streakWidgetTitle,
                        themeHabits.styles.streakWidgetTitleCompact,
                    ]} numberOfLines={1}>{resolvedTitle}</Text>
                    {badge}
                </View>
                {!!metaParts.length && (
                    <View style={themeHabits.styles.streakProgressRowCompact}>
                        <View style={[
                            themeHabits.styles.streakProgressBar,
                            themeHabits.styles.streakProgressBarCompact,
                        ]}>
                            <View
                                style={[
                                    themeHabits.styles.streakProgressFill,
                                    themeHabits.styles.streakProgressFillCompact,
                                    { width: `${Math.min(progress, 100)}%` },
                                ]}
                            />
                        </View>
                        <Text style={themeHabits.styles.streakMetaTextCompact} numberOfLines={1}>
                            {metaParts.join(' · ')}
                        </Text>
                    </View>
                )}
            </View>
        );
    }

    return (
        <View style={themeHabits.styles.streakWidgetContainer}>
            <View style={themeHabits.styles.streakWidgetHeader}>
                <Text style={themeHabits.styles.streakWidgetTitle}>{resolvedTitle}</Text>
                {badge}
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
                            {translate('pages.habits.streak.nextMilestone', { days: nextMilestone })}
                        </Text>
                        <Text style={themeHabits.styles.streakProgressText}>
                            {streak.currentStreak}/{nextMilestone}
                        </Text>
                    </View>
                </View>
            )}

            {hasFreezeAllowance && (
                <Text style={[themeHabits.styles.streakMilestoneText, { marginTop: 8 }]}>
                    {hasGraceDays
                        ? translate('pages.habits.streak.graceDaysRemaining', {
                            count: graceDaysRemaining,
                        })
                        : translate('pages.habits.streak.graceDaysExhausted')}
                </Text>
            )}
        </View>
    );
};

export default StreakWidget;
