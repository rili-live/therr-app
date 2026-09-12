import React from 'react';
import {
    View, Text, Pressable, ActivityIndicator,
} from 'react-native';
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
    /**
     * "Add a note or photo" for a check-in already logged today. Surfaced by
     * CheckinButton only once the habit is completed, so a missed or dismissed
     * proof sheet is still reachable.
     */
    onAddCheckinDetail?: () => void;
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
    /**
     * "Keep this habit alone." Present only on an awaiting-partner card whose
     * tracking row is known. When set, the card offers the solo/archive choice
     * that ends the annoying reminders for a habit nobody has joined.
     */
    onContinueSolo?: () => void;
    /** "Stop the reminders until a partner joins." Pairs with `onContinueSolo`. */
    onArchive?: () => void;
    /** Disables both decision buttons and shows a spinner while a request runs. */
    isAwaitingActionLoading?: boolean;
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
    onAddCheckinDetail,
    isCheckinLoading = false,
    showStreak = true,
    isAwaitingPartner = false,
    awaitingPartnerNames,
    partnerNames,
    onContinueSolo,
    onArchive,
    isAwaitingActionLoading = false,
    themeHabits,
    translate,
}) => {
    const isCompleted = todayCheckin?.status === 'completed';
    const showSoloOrArchive = isAwaitingPartner && !!onContinueSolo && !!onArchive;

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

            {showSoloOrArchive && (
                <View style={themeHabits.styles.habitCardSoloPrompt}>
                    <Text style={themeHabits.styles.habitCardSoloPromptText}>
                        {translate('pages.habits.soloOrArchivePrompt')}
                    </Text>
                    {isAwaitingActionLoading ? (
                        <ActivityIndicator
                            color={themeHabits.colors.primary3}
                            style={themeHabits.styles.habitCardSoloSpinner}
                        />
                    ) : (
                        <View style={themeHabits.styles.habitCardSoloActions}>
                            <Pressable
                                accessibilityRole="button"
                                accessibilityLabel={translate('pages.habits.continueSolo')}
                                style={({ pressed }) => [
                                    themeHabits.styles.habitCardSoloButton,
                                    pressed && themeHabits.styles.pressedOpacity,
                                ]}
                                onPress={onContinueSolo}
                            >
                                <Text style={themeHabits.styles.habitCardSoloButtonText}>
                                    {translate('pages.habits.continueSolo')}
                                </Text>
                            </Pressable>
                            <Pressable
                                accessibilityRole="button"
                                accessibilityLabel={translate('pages.habits.archiveHabit')}
                                style={({ pressed }) => [
                                    themeHabits.styles.habitCardArchiveButton,
                                    pressed && themeHabits.styles.pressedOpacity,
                                ]}
                                onPress={onArchive}
                            >
                                <Text style={themeHabits.styles.habitCardArchiveButtonText}>
                                    {translate('pages.habits.archiveHabit')}
                                </Text>
                            </Pressable>
                        </View>
                    )}
                </View>
            )}

            {onCheckin && !isAwaitingPartner && (
                <View style={themeHabits.styles.habitCardFooter}>
                    <CheckinButton
                        isCompleted={isCompleted}
                        isLoading={isCheckinLoading}
                        onPress={onCheckin}
                        onAddDetail={onAddCheckinDetail}
                        addDetailTitle={translate('pages.habits.checkinProof.addDetailButton')}
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
