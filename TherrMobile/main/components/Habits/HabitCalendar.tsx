import React, { useMemo } from 'react';
import { View, Text, Pressable } from 'react-native';
import MaterialIcon from 'react-native-vector-icons/MaterialIcons';
import { IHabitCheckin } from 'therr-react/types';
import { ITherrThemeColors } from '../../styles/themes';

interface IHabitCalendarProps {
    checkins: IHabitCheckin[];
    month: Date;
    onMonthChange: (date: Date) => void;
    onDayPress?: (date: Date, checkin?: IHabitCheckin) => void;
    themeHabits: {
        colors: ITherrThemeColors;
        styles: any;
    };
}

const DAYS_OF_WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const formatDateKey = (date: Date): string => date.toISOString().split('T')[0];

const HabitCalendar: React.FC<IHabitCalendarProps> = ({
    checkins,
    month,
    onMonthChange,
    onDayPress,
    themeHabits,
}) => {
    const checkinMap = useMemo(() => {
        const map: Record<string, IHabitCheckin> = {};
        checkins.forEach((checkin) => {
            const key = checkin.scheduledDate.split('T')[0];
            map[key] = checkin;
        });
        return map;
    }, [checkins]);

    const today = new Date();
    const todayKey = formatDateKey(today);

    const year = month.getFullYear();
    const monthIndex = month.getMonth();
    const monthName = month.toLocaleString('default', { month: 'long', year: 'numeric' });

    const firstDayOfMonth = new Date(year, monthIndex, 1);
    const lastDayOfMonth = new Date(year, monthIndex + 1, 0);
    const startDayOfWeek = firstDayOfMonth.getDay();
    const daysInMonth = lastDayOfMonth.getDate();

    const handlePrevMonth = () => {
        onMonthChange(new Date(year, monthIndex - 1, 1));
    };

    const handleNextMonth = () => {
        onMonthChange(new Date(year, monthIndex + 1, 1));
    };

    const getDayStyle = (dateKey: string, checkin?: IHabitCheckin) => {
        const isToday = dateKey === todayKey;
        const baseStyles = [themeHabits.styles.calendarDayCircle];

        if (isToday) {
            baseStyles.push(themeHabits.styles.calendarDayToday);
        }

        if (!checkin) {
            return baseStyles;
        }

        switch (checkin.status) {
            case 'completed':
                baseStyles.push(themeHabits.styles.calendarDayCompleted);
                break;
            case 'partial':
                baseStyles.push(themeHabits.styles.calendarDayPartial);
                break;
            case 'missed':
                baseStyles.push(themeHabits.styles.calendarDayMissed);
                break;
            case 'skipped':
                baseStyles.push(themeHabits.styles.calendarDaySkipped);
                break;
            default:
                break;
        }

        return baseStyles;
    };

    const getDayTextStyle = (checkin?: IHabitCheckin) => {
        const baseStyles = [themeHabits.styles.calendarDayText];

        if (checkin && ['completed', 'missed'].includes(checkin.status)) {
            baseStyles.push(themeHabits.styles.calendarDayTextCompleted);
        }

        return baseStyles;
    };

    const renderDays = () => {
        const days = [];

        // Empty cells for days before the first of the month
        for (let i = 0; i < startDayOfWeek; i += 1) {
            days.push(<View key={`empty-${i}`} style={themeHabits.styles.calendarDay} />);
        }

        // Days of the month
        for (let day = 1; day <= daysInMonth; day += 1) {
            const date = new Date(year, monthIndex, day);
            const dateKey = formatDateKey(date);
            const checkin = checkinMap[dateKey];

            days.push(
                <Pressable
                    key={dateKey}
                    style={themeHabits.styles.calendarDay}
                    onPress={() => onDayPress?.(date, checkin)}
                >
                    <View style={getDayStyle(dateKey, checkin)}>
                        <Text style={getDayTextStyle(checkin)}>{day}</Text>
                    </View>
                </Pressable>,
            );
        }

        return days;
    };

    return (
        <View style={themeHabits.styles.calendarContainer}>
            <View style={themeHabits.styles.calendarHeader}>
                <Pressable
                    style={themeHabits.styles.calendarNavButton}
                    onPress={handlePrevMonth}
                >
                    <MaterialIcon
                        name="chevron-left"
                        size={24}
                        color={themeHabits.colors.textBlack}
                    />
                </Pressable>
                <Text style={themeHabits.styles.calendarTitle}>{monthName}</Text>
                <Pressable
                    style={themeHabits.styles.calendarNavButton}
                    onPress={handleNextMonth}
                >
                    <MaterialIcon
                        name="chevron-right"
                        size={24}
                        color={themeHabits.colors.textBlack}
                    />
                </Pressable>
            </View>

            <View style={themeHabits.styles.calendarGrid}>
                {DAYS_OF_WEEK.map((day) => (
                    <View key={day} style={themeHabits.styles.calendarDayHeader}>
                        <Text style={themeHabits.styles.calendarDayHeaderText}>{day}</Text>
                    </View>
                ))}
                {renderDays()}
            </View>
        </View>
    );
};

export default HabitCalendar;
