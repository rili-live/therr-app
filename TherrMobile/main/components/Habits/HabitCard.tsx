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
    themeHabits: {
        colors: ITherrThemeColors;
        styles: any;
    };
    translate: (key: string, params?: any) => string;
}

const getFrequencyText = (habitGoal: IHabitGoal): string => {
    const { frequencyType, frequencyCount, targetDaysOfWeek } = habitGoal;

    if (frequencyType === 'daily') {
        return 'Every day';
    }

    if (frequencyType === 'weekly' && targetDaysOfWeek && targetDaysOfWeek.length > 0) {
        const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const days = targetDaysOfWeek.map((d) => dayNames[d]).join(', ');
        return `${days}`;
    }

    if (frequencyType === 'weekly') {
        return `${frequencyCount}x per week`;
    }

    return `${frequencyCount}x per ${frequencyType}`;
};

const HabitCard: React.FC<IHabitCardProps> = ({
    habitGoal,
    todayCheckin,
    streak,
    onPress,
    onCheckin,
    isCheckinLoading = false,
    showStreak = true,
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
                        {getFrequencyText(habitGoal)}
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

            {showStreak && streak && streak.currentStreak > 0 && (
                <StreakWidget
                    streak={streak}
                    themeHabits={themeHabits}
                />
            )}

            {onCheckin && (
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
