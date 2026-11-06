import React, { useMemo } from 'react';
import { Text, View } from 'react-native';
import type { IDailyStreakCalendarDay } from 'therr-react/services';
import { ITherrThemeColors } from '../../styles/themes';
import { buildCalendarRows } from '../../routes/DailyStreak/calendarGrid';

interface IDailyStreakCalendarProps {
    days: IDailyStreakCalendarDay[];
    themeHabits: {
        colors: ITherrThemeColors;
        styles: any;
    };
    translate: (key: string, params?: any) => string;
}

const DAYS_OF_WEEK_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

const FREEZE_GLYPH = '❄️'; // snowflake

/**
 * One month of the app-level daily streak ledger, Sunday-first like the per-habit calendar.
 *
 * Each status is told apart by shape as well as colour, so the grid still parses without colour
 * vision: upheld is a filled circle, frozen a tinted circle carrying a snowflake, missed is red
 * text with no circle, a pending today is an outline ring, and rest / untracked / future days
 * are plain or faded numbers. A band behind consecutive kept days draws the run itself, so the
 * break a miss causes is visible without reading every cell.
 *
 * Display-only; month navigation lives on the screen, which owns the fetch.
 */
const DailyStreakCalendar: React.FC<IDailyStreakCalendarProps> = ({ days, themeHabits, translate }) => {
    const rows = useMemo(() => buildCalendarRows(days), [days]);
    const { styles } = themeHabits;

    return (
        <View>
            <View style={styles.calendarGrid}>
                {DAYS_OF_WEEK_KEYS.map((dayKey) => (
                    <View key={dayKey} style={styles.calendarDayHeader}>
                        <Text style={styles.calendarDayHeaderText}>
                            {translate(`pages.habits.daysOfWeekShort.${dayKey}`)}
                        </Text>
                    </View>
                ))}
            </View>
            {rows.map((row, rowIndex) => (
                <View key={`row-${rowIndex}`} style={styles.calendarGrid}>
                    {row.map((cell, columnIndex) => {
                        if (!cell) {
                            return <View key={`pad-${rowIndex}-${columnIndex}`} style={styles.calendarDay} />;
                        }
                        const { day, dayOfMonth, bandLeft, bandRight } = cell;
                        const { status } = day;
                        return (
                            <View
                                key={day.date}
                                style={styles.calendarDay}
                                accessible
                                accessibilityLabel={translate(`pages.dailyStreak.dayStatus.${status}`, { date: day.date })}
                            >
                                {bandLeft && <View style={[styles.dailyStreakBand, styles.dailyStreakBandLeft]} />}
                                {bandRight && <View style={[styles.dailyStreakBand, styles.dailyStreakBandRight]} />}
                                <View
                                    style={[
                                        styles.calendarDayCircle,
                                        status === 'upheld' && styles.dailyStreakDayUpheld,
                                        status === 'frozen' && styles.dailyStreakDayFrozen,
                                        status === 'pending' && styles.calendarDayToday,
                                        day.isToday && status !== 'pending' && styles.dailyStreakDayTodayRing,
                                    ]}
                                >
                                    <Text
                                        style={[
                                            styles.calendarDayText,
                                            status === 'upheld' && styles.dailyStreakDayTextUpheld,
                                            status === 'frozen' && styles.dailyStreakDayTextFrozen,
                                            status === 'missed' && styles.dailyStreakDayTextMissed,
                                            (status === 'rest' || status === 'none') && styles.dailyStreakDayTextMuted,
                                            status === 'future' && styles.dailyStreakDayTextFuture,
                                        ]}
                                    >
                                        {dayOfMonth}
                                    </Text>
                                    {status === 'frozen' && (
                                        <Text style={styles.dailyStreakDayFreezeBadge}>{FREEZE_GLYPH}</Text>
                                    )}
                                </View>
                            </View>
                        );
                    })}
                </View>
            ))}
        </View>
    );
};

export default DailyStreakCalendar;
