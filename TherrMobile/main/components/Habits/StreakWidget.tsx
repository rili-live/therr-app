import React from 'react';
import { View, Text } from 'react-native';
import { IStreak } from 'therr-react/types';
import { ITherrThemeColors } from '../../styles/themes';

interface IStreakWidgetProps {
    streak: IStreak;
    title?: string;
    /**
     * Collapses the widget into two rows (title + badge, then the progress bar with
     * its milestone summary and freeze pips inline). Used where the widget shares the
     * viewport with scrollable content below it, such as the profile header.
     */
    compact?: boolean;
    /**
     * Drops the widget's own card chrome — surface colour, shadow, padding, side
     * margins — for call sites that render it *inside* another card. Without it a
     * habit row in a list draws a card within a card and pays for two sets of insets.
     */
    embedded?: boolean;
    themeHabits: {
        colors: ITherrThemeColors;
        styles: any;
    };
    translate: (key: string, params?: any) => string;
}

const MILESTONES = [3, 7, 14, 30, 60, 90, 180, 365];

/** Beyond this the pips stop being countable at a glance; the rest collapse into "+N". */
const MAX_RENDERED_FREEZE_PIPS = 5;

const FREEZE_GLYPH = '❄️'; // snowflake

const getNextMilestone = (currentStreak: number): number | null => {
    const next = MILESTONES.find((m) => m > currentStreak);
    return next || null;
};

const getStreakEmoji = (currentStreak: number): string => {
    if (currentStreak >= 365) {return '🏆';} // trophy
    if (currentStreak >= 180) {return '💎';} // gem
    if (currentStreak >= 90) {return '⭐';} // star
    if (currentStreak >= 60) {return '🔥';} // fire
    if (currentStreak >= 30) {return '💪';} // muscle
    if (currentStreak >= 14) {return '🌟';} // glowing star
    if (currentStreak >= 7) {return '✨';} // sparkles
    if (currentStreak >= 3) {return '🚀';} // rocket
    return '🌱'; // seedling
};

/**
 * One pip per streak freeze the habit was allotted, spent ones outlined rather than filled.
 *
 * Replaces a sentence carrying a bare count ("2 streak freezes left"), which told the reader
 * how much cover they had but not how much they started with — so there was no way to see that
 * two of three were already gone without doing arithmetic the screen never showed. Slots are
 * rendered for the whole allotment for exactly that reason.
 */
const FreezePips = ({
    allotted,
    remaining,
    compact = false,
    themeHabits,
    translate,
}: {
    allotted: number;
    remaining: number;
    compact?: boolean;
    themeHabits: IStreakWidgetProps['themeHabits'];
    translate: IStreakWidgetProps['translate'];
}) => {
    const rendered = Math.min(allotted, MAX_RENDERED_FREEZE_PIPS);
    const overflow = allotted - rendered;

    return (
        <View
            style={compact
                ? themeHabits.styles.streakFreezeRowCompact
                : themeHabits.styles.streakFreezePipRow}
            accessibilityRole="image"
            accessibilityLabel={translate('pages.habits.streak.freezePipsAccessibility', {
                remaining,
                total: allotted,
            })}
        >
            {Array.from({ length: rendered }, (_unused, index) => (
                <View
                    key={index}
                    style={[
                        themeHabits.styles.streakFreezePip,
                        compact && themeHabits.styles.streakFreezePipCompact,
                        index < remaining
                            ? themeHabits.styles.streakFreezePipAvailable
                            : themeHabits.styles.streakFreezePipSpent,
                    ]}
                >
                    <Text style={[
                        themeHabits.styles.streakFreezePipText,
                        compact && themeHabits.styles.streakFreezePipTextCompact,
                    ]}>
                        {FREEZE_GLYPH}
                    </Text>
                </View>
            ))}
            {overflow > 0 && (
                <Text style={themeHabits.styles.streakFreezeOverflowText}>
                    {`+${overflow}`}
                </Text>
            )}
        </View>
    );
};

const StreakWidget: React.FC<IStreakWidgetProps> = ({
    streak,
    title,
    compact = false,
    embedded = false,
    themeHabits,
    translate,
}) => {
    const resolvedTitle = title ?? translate('pages.habits.currentStreak');
    const nextMilestone = getNextMilestone(streak.currentStreak);
    const progress = nextMilestone
        ? (streak.currentStreak / nextMilestone) * 100
        : 100;
    const emoji = streak.emoji || getStreakEmoji(streak.currentStreak);
    const graceDaysRemaining = Math.max(streak.gracePeriodDays - streak.graceDaysUsed, 0);
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

    const progressBar = (
        <View style={[
            themeHabits.styles.streakProgressBar,
            compact && themeHabits.styles.streakProgressBarCompact,
        ]}>
            <View
                style={[
                    themeHabits.styles.streakProgressFill,
                    compact && themeHabits.styles.streakProgressFillCompact,
                    { width: `${Math.min(progress, 100)}%` },
                ]}
            />
        </View>
    );

    if (compact) {
        // Milestone collapses onto a single abbreviated line beside the progress bar, and the
        // freezes become pips on that same line, so the whole widget stays two rows tall.
        const meta = nextMilestone
            ? `${streak.currentStreak}/${nextMilestone} · ${translate('pages.habits.streak.nextMilestoneCompact', { days: nextMilestone })}`
            : '';
        const hasMetaRow = !!meta || hasFreezeAllowance;

        return (
            <View style={[
                themeHabits.styles.streakWidgetContainerCompact,
                embedded && themeHabits.styles.streakWidgetContainerEmbedded,
            ]}>
                <View style={themeHabits.styles.streakWidgetHeaderCompact}>
                    <Text style={[
                        themeHabits.styles.streakWidgetTitle,
                        themeHabits.styles.streakWidgetTitleCompact,
                    ]} numberOfLines={1}>{resolvedTitle}</Text>
                    {badge}
                </View>
                {hasMetaRow && (
                    <View style={themeHabits.styles.streakProgressRowCompact}>
                        {!!nextMilestone && progressBar}
                        {!!meta && (
                            <Text style={themeHabits.styles.streakMetaTextCompact} numberOfLines={1}>
                                {meta}
                            </Text>
                        )}
                        {hasFreezeAllowance && (
                            <FreezePips
                                allotted={streak.gracePeriodDays}
                                remaining={graceDaysRemaining}
                                compact
                                themeHabits={themeHabits}
                                translate={translate}
                            />
                        )}
                    </View>
                )}
            </View>
        );
    }

    return (
        <View style={[
            themeHabits.styles.streakWidgetContainer,
            embedded && themeHabits.styles.streakWidgetContainerEmbedded,
        ]}>
            <View style={themeHabits.styles.streakWidgetHeader}>
                <Text style={themeHabits.styles.streakWidgetTitle}>{resolvedTitle}</Text>
                {badge}
            </View>

            {nextMilestone && (
                <View style={themeHabits.styles.streakProgressContainer}>
                    {progressBar}
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
                <View style={themeHabits.styles.streakFreezeSection}>
                    <View style={themeHabits.styles.streakFreezeHeaderRow}>
                        <Text style={themeHabits.styles.streakFreezeLabel}>
                            {translate('pages.habits.streak.freezesLabel', {
                                remaining: graceDaysRemaining,
                                total: streak.gracePeriodDays,
                            })}
                        </Text>
                        <FreezePips
                            allotted={streak.gracePeriodDays}
                            remaining={graceDaysRemaining}
                            themeHabits={themeHabits}
                            translate={translate}
                        />
                    </View>
                    <Text style={[
                        themeHabits.styles.streakFreezeCaption,
                        !hasGraceDays && themeHabits.styles.streakFreezeCaptionExhausted,
                    ]}>
                        {hasGraceDays
                            ? translate('pages.habits.streak.graceDaysRemaining', {
                                count: graceDaysRemaining,
                            })
                            : translate('pages.habits.streak.graceDaysExhausted')}
                    </Text>
                </View>
            )}
        </View>
    );
};

export default StreakWidget;
