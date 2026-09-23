import React from 'react';
import {
    View, Text, Pressable, ActivityIndicator,
} from 'react-native';
import {
    IHabitGoal, IHabitCheckin, IStreak,
} from 'therr-react/types';
import { ITherrThemeColors } from '../../styles/themes';
import { fromGoal, IWeekProgress } from '../../routes/Pacts/cadenceOptions';
import CheckinButton from './CheckinButton';
import StreakWidget from './StreakWidget';

interface IHabitCardProps {
    habitGoal: IHabitGoal;
    todayCheckin?: IHabitCheckin;
    streak?: IStreak;
    /**
     * Where the user stands in this habit's week, as the server computed it.
     *
     * A separate prop rather than a field on `habitGoal` because it is per-*user*, not per-goal
     * — a template shared by two people has one cadence and two different weeks. Absent means
     * unknown: the chip is hidden, never shown as zero.
     */
    weekProgress?: IWeekProgress;
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

/**
 * The cadence in words.
 *
 * Precedence comes from `cadenceOptions.fromGoal`, which mirrors the server's `getCadence`.
 * This used to decide it inline, and got it wrong in exactly the way the old backend did: it
 * required `frequencyType === 'weekly'` before honouring a weekday schedule, so a `custom` goal
 * with fixed days rendered "3x per custom" and a `daily` goal with fixed days rendered "Every
 * day" — while the server scheduled, reminded and scored it on those weekdays. The label and
 * the rules now agree by construction.
 *
 * `monthly` has no backend support (`getCadence` reads it as a weekly count), but the copy
 * exists in all three locales and a goal could carry it, so it keeps its branch rather than
 * silently rendering as weekly.
 */
const getFrequencyText = (
    habitGoal: IHabitGoal,
    translate: (key: string, params?: any) => string,
): string => {
    const cadence = fromGoal(habitGoal);

    if (cadence.kind === 'weekdays') {
        return cadence.days
            .map((d) => translate(`pages.habits.daysOfWeekShort.${DAY_SHORT_KEYS[d]}`))
            .join(', ');
    }

    if (cadence.kind === 'daily') {
        return translate('pages.habits.frequency.daily');
    }

    if (habitGoal.frequencyType === 'monthly') {
        return translate('pages.habits.frequency.monthly', { count: habitGoal.frequencyCount });
    }

    return translate('pages.habits.frequency.weekly', { count: cadence.count });
};

/**
 * "2 of 4 this week", when there is a week to report on.
 *
 * Returns null for a daily habit — its progress is the streak, and a chip saying "3 of 7" beside
 * a 3-day streak is noise — and for an absent `weekProgress`, which means *unknown* rather than
 * zero. The server omits the field when it could not resolve the user's week, and a server that
 * predates it omits it too; rendering "0 of 4" for someone who trained four times is worse than
 * rendering nothing.
 */
const getWeekProgressText = (
    weekProgress: IWeekProgress | undefined,
    translate: (key: string, params?: any) => string,
): string | null => {
    if (!weekProgress || weekProgress.target >= 7 || weekProgress.target < 1) {
        return null;
    }

    const key = weekProgress.isMet
        ? 'pages.habits.cadence.weekProgressMet'
        : 'pages.habits.cadence.weekProgress';

    return translate(key, { done: weekProgress.done, target: weekProgress.target });
};

const HabitCard: React.FC<IHabitCardProps> = ({
    habitGoal,
    todayCheckin,
    streak,
    weekProgress,
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
    const weekProgressText = getWeekProgressText(weekProgress, translate);

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
                {/*
                  * Sits in the header rather than beside the streak, because it answers a
                  * different question: the streak says how long you have kept the habit, this
                  * says whether this week is still owed anything. Rendered only when there is
                  * a week to report on — see `getWeekProgressText`.
                  */}
                {!!weekProgressText && (
                    <View style={[
                        themeHabits.styles.habitCardProgressChip,
                        weekProgress?.isMet && themeHabits.styles.habitCardProgressChipMet,
                    ]}>
                        <Text style={themeHabits.styles.habitCardProgressChipText}>
                            {weekProgressText}
                        </Text>
                    </View>
                )}
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
                /*
                 * Compact and embedded, always. This card is a list row: the full widget stacks
                 * four rows and draws its own surface, shadow and 16dp side margins *inside* a
                 * card that already has all three, so a habit list was a column of cards within
                 * cards and only two or three rows ever fit on screen. The compact layout
                 * carries the same numbers in two rows, and `embedded` strips the duplicate
                 * chrome. The full widget stays where it has the room — the habit detail screen.
                 */
                <StreakWidget
                    streak={streak}
                    compact
                    embedded
                    cadenceKind={fromGoal(habitGoal).kind}
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
