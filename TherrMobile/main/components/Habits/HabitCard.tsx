import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { IHabitGoal, IHabitCheckin, IStreak } from 'therr-react/types';
import { ITherrThemeColors } from '../../styles/themes';
import CheckinButton from './CheckinButton';
import StreakWidget from './StreakWidget';

interface IHabitCardProps {
    habitGoal: IHabitGoal;
    todayCheckin?: IHabitCheckin;
    streak?: IStreak;
    onPress?: () => void;
    onCheckin?: () => void;
    isCheckinLoading?: boolean;
    showStreak?: boolean;
    /**
     * Set when the habit's only pacts are still awaiting an invitee's
     * acceptance. The card then explains who it is waiting on instead of
     * offering a check-in for a pact that has not started.
     */
    isAwaitingPartner?: boolean;
    /** Invitees yet to accept. May be empty when their names are unknown. */
    awaitingPartnerNames?: string[];
    /** Partners already checked into this habit's active pact. */
    partnerNames?: string[];
    themeHabits: {
        colors: ITherrThemeColors;
        styles: any;
    };
    translate: (key: string, params?: any) => string;
}

const DAY_SHORT_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

const getFrequencyText = (
    habitGoal: IHabitGoal,
    translate: (key: string, params?: any) => string,
): string => {
    const { frequencyType, frequencyCount, targetDaysOfWeek } = habitGoal;

    if (frequencyType === 'daily') {
        return translate('pages.habits.frequency.daily');
    }

    if (frequencyType === 'weekly' && targetDaysOfWeek && targetDaysOfWeek.length > 0) {
        return targetDaysOfWeek
            .map((d) => translate(`pages.habits.daysOfWeekShort.${DAY_SHORT_KEYS[d]}`))
            .join(', ');
    }

    if (frequencyType === 'weekly') {
        return translate('pages.habits.frequency.weekly', { count: frequencyCount });
    }

    if (frequencyType === 'monthly') {
        return translate('pages.habits.frequency.monthly', { count: frequencyCount });
    }

    return translate('pages.habits.frequency.perPeriod', {
        count: frequencyCount,
        period: frequencyType,
    });
};

const HabitCard: React.FC<IHabitCardProps> = ({
    habitGoal,
    todayCheckin,
    streak,
    onPress,
    onCheckin,
    isCheckinLoading = false,
    showStreak = true,
    isAwaitingPartner = false,
    awaitingPartnerNames,
    partnerNames,
    themeHabits,
    translate,
}) => {
    const isCompleted = todayCheckin?.status === 'completed';

    return (
        <Pressable
            style={themeHabits.styles.habitCardContainer}
            onPress={onPress}
        >
            <View style={themeHabits.styles.habitCardHeader}>
                <Text style={themeHabits.styles.habitCardEmoji}>
                    {habitGoal.emoji || '\uD83C\uDFAF'}
                </Text>
                <View style={themeHabits.styles.habitCardTitleContainer}>
                    <Text style={themeHabits.styles.habitCardTitle}>
                        {habitGoal.name}
                    </Text>
                    <Text style={themeHabits.styles.habitCardSubtitle}>
                        {getFrequencyText(habitGoal, translate)}
                    </Text>
                </View>
            </View>

            {habitGoal.description && (
                <View style={themeHabits.styles.habitCardBody}>
                    <Text style={themeHabits.styles.habitCardSubtitle}>
                        {habitGoal.description}
                    </Text>
                </View>
            )}

            {!!partnerNames?.length && (
                <Text style={themeHabits.styles.habitCardPartnerText}>
                    {translate('pages.habits.pactWithPartners', {
                        partners: partnerNames.join(', '),
                    })}
                </Text>
            )}

            {showStreak && !isAwaitingPartner && streak && streak.currentStreak > 0 && (
                <StreakWidget
                    streak={streak}
                    themeHabits={themeHabits}
                    translate={translate}
                />
            )}

            {isAwaitingPartner && (
                <Text style={themeHabits.styles.habitCardAwaitingText}>
                    {awaitingPartnerNames?.length
                        ? translate('pages.habits.awaitingPartnerAcceptance', {
                            partners: awaitingPartnerNames.join(', '),
                        })
                        : translate('pages.habits.awaitingAnyPartnerAcceptance')}
                </Text>
            )}

            {onCheckin && !isAwaitingPartner && (
                <View style={themeHabits.styles.habitCardFooter}>
                    <CheckinButton
                        isCompleted={isCompleted}
                        isLoading={isCheckinLoading}
                        onPress={onCheckin}
                        title={translate('pages.habits.checkin')}
                        completedTitle={translate('pages.habits.completed')}
                        themeHabits={themeHabits}
                    />
                </View>
            )}
        </Pressable>
    );
};

export default HabitCard;
