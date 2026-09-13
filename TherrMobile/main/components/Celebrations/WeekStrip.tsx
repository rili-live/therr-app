import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import MaterialIcon from 'react-native-vector-icons/MaterialIcons';
import { IDailyStreakWeekDay } from 'therr-react/types';
import { ITherrThemeColors } from '../../styles/themes';

/**
 * Mon–Sun strip of the current week, as the daily-streak ledger recorded it.
 *
 * Statuses come from the server (`GET /habits/daily-streak/me`), never from the client's own
 * calendar: `upheld` is a real check-in, `frozen` is a day a streak freeze covered, `missed` is
 * a day that broke the streak, `pending` is today before checking in, and `future` is the rest
 * of the week. Frozen gets its own colour and a shield rather than a check — the distinction is
 * the point of the mechanic, and a frozen day is also what makes a week not perfect.
 */
interface IWeekStripProps {
    days: IDailyStreakWeekDay[];
    /** Localised single-letter or short weekday labels, Monday first. */
    dayLabels: string[];
    colors: ITherrThemeColors;
    accessibilityLabel?: string;
}

export const FROZEN_COLOR = '#4FA8E8';

const WeekStrip: React.FC<IWeekStripProps> = ({
    days,
    dayLabels,
    colors,
    accessibilityLabel,
}) => (
    <View
        style={styles.container}
        accessible
        accessibilityRole="summary"
        accessibilityLabel={accessibilityLabel}
    >
        {days.map((day) => {
            const isUpheld = day.status === 'upheld';
            const isFrozen = day.status === 'frozen';
            const isMissed = day.status === 'missed';

            return (
                <View key={day.date} style={styles.dayColumn}>
                    <Text
                        style={[
                            styles.dayLabel,
                            {
                                color: colors.textWhite,
                                fontWeight: day.isToday ? '800' : '500',
                                opacity: day.isToday ? 1 : 0.6,
                            },
                        ]}
                    >
                        {dayLabels[day.dow] || ''}
                    </Text>
                    <View
                        style={[
                            styles.circle,
                            { borderColor: colors.textGray },
                            isUpheld && { backgroundColor: colors.brand, borderColor: colors.brand },
                            isFrozen && { backgroundColor: FROZEN_COLOR, borderColor: FROZEN_COLOR },
                            isMissed && styles.circleMissed,
                            day.isToday && !isUpheld && !isFrozen && {
                                borderColor: colors.brand,
                                borderWidth: 2,
                            },
                        ]}
                    >
                        {isUpheld ? <MaterialIcon name="check" size={18} color={colors.brandingWhite} /> : null}
                        {isFrozen ? <MaterialIcon name="shield" size={15} color={colors.brandingWhite} /> : null}
                    </View>
                </View>
            );
        })}
    </View>
);

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 10,
        marginTop: 24,
    },
    dayColumn: {
        alignItems: 'center',
        gap: 6,
    },
    dayLabel: {
        fontSize: 12,
    },
    circle: {
        width: 30,
        height: 30,
        borderRadius: 15,
        borderWidth: 1.5,
        alignItems: 'center',
        justifyContent: 'center',
    },
    circleMissed: {
        opacity: 0.35,
    },
});

export default WeekStrip;
