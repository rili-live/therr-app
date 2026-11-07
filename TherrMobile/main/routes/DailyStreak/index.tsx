import React, {
    useCallback, useEffect, useMemo, useRef, useState,
} from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { RefreshControl } from 'react-native-gesture-handler';
import { SafeAreaView } from 'react-native-safe-area-context';
import MaterialIcon from 'react-native-vector-icons/MaterialIcons';
import { useSelector } from 'react-redux';
import { DailyStreakService } from 'therr-react/services';
import type { IDailyStreakCalendar } from 'therr-react/services';
import { IUserHabit, IUserState } from 'therr-react/types';
import { buildStyles } from '../../styles';
import { buildStyles as buildMenuStyles, buttonMenuHeight } from '../../styles/navigation/buttonMenu';
import { buildStyles as buildHabitStyles } from '../../styles/habits';
import BaseStatusBar from '../../components/BaseStatusBar';
import MainButtonMenu from '../../components/ButtonMenu/MainButtonMenu';
import { HabitsListLoader } from '../../components/Habits';
import DailyStreakCalendar from '../../components/Habits/DailyStreakCalendar';
import translator from '../../utilities/translator';
import { logAppEvent } from '../../utilities/analyticsEvents';
import getDeviceTimeZone from '../../utilities/deviceTimeZone';
import { getMonthIndex, MONTH_KEYS, shiftMonth } from './calendarGrid';

const FREEZE_GLYPH = '❄️'; // snowflake
const STREAK_GLYPH = '🔥'; // fire

/** Beyond this the pips stop being countable at a glance; the rest collapse into "+N". */
const MAX_RENDERED_FREEZE_PIPS = 6;

interface IDailyStreakProps {
    navigation: any;
}

/**
 * The app-level daily streak in detail: the number, the freezes protecting it, and a month
 * calendar of the ledger behind it. Opened from the "Overall streak" stat on the habits
 * dashboard.
 *
 * Read-only and fetched locally rather than through a redux slice, like WeeklyRecap: one screen
 * consumes it, and the month on screen is screen state by definition. The month the arrows move
 * from is always the one the server returned, never the one requested — the server normalizes a
 * junk or future month to the current one.
 */
const DailyStreak: React.FC<IDailyStreakProps> = ({ navigation }) => {
    const user: IUserState = useSelector((state: any) => state.user);
    const userHabits: IUserHabit[] = useSelector((state: any) => state.habits?.userHabits || []);
    const themeName = user?.settings?.mobileThemeName;
    const locale = user?.settings?.locale || 'en-us';

    const theme = useMemo(() => buildStyles(themeName), [themeName]);
    const themeMenu = useMemo(() => buildMenuStyles(themeName), [themeName]);
    const themeHabits = useMemo(() => buildHabitStyles(themeName), [themeName]);
    const translate = useCallback(
        (key: string, params?: any) => translator(locale, key, params),
        [locale],
    );

    const [calendar, setCalendar] = useState<IDailyStreakCalendar | null>(null);
    const [hasFetched, setHasFetched] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [hasError, setHasError] = useState(false);
    const isMounted = useRef(true);
    // Guards against an earlier month's response landing after a later one: tapping the arrow
    // twice quickly must not leave the screen on the month the user tapped away from.
    const latestRequest = useRef(0);

    const loadMonth = useCallback((month?: string) => {
        latestRequest.current += 1;
        const requestId = latestRequest.current;
        setIsLoading(true);
        setHasError(false);

        return DailyStreakService.getCalendar(month, getDeviceTimeZone() || undefined)
            .then((response: any) => {
                if (!isMounted.current || requestId !== latestRequest.current) {
                    return;
                }
                const data: IDailyStreakCalendar | undefined = response?.data;
                if (data && Array.isArray(data.days) && data.freezes && Array.isArray(data.freezes.habits)) {
                    setCalendar(data);
                } else {
                    setHasError(true);
                }
            })
            .catch(() => {
                if (!isMounted.current || requestId !== latestRequest.current) {
                    return;
                }
                setHasError(true);
            })
            .finally(() => {
                if (!isMounted.current || requestId !== latestRequest.current) {
                    return;
                }
                setIsLoading(false);
                setHasFetched(true);
            });
    }, []);

    useEffect(() => {
        isMounted.current = true;
        navigation.setOptions({ title: translate('pages.dailyStreak.headerTitle') });
        loadMonth();
        logAppEvent('daily_streak_detail_view', { userId: user?.details?.id });

        return () => {
            isMounted.current = false;
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const onRefresh = useCallback(() => {
        loadMonth(calendar?.month);
    }, [calendar?.month, loadMonth]);

    const goToMonth = useCallback((offset: number) => {
        if (!calendar) {
            return;
        }
        loadMonth(shiftMonth(calendar.month, offset));
    }, [calendar, loadMonth]);

    const habitNames = useMemo(() => {
        const names: Record<string, { name: string; emoji?: string | null }> = {};
        userHabits.forEach((habit) => {
            names[habit.habitGoalId] = { name: habit.goalName, emoji: habit.goalEmoji };
        });
        return names;
    }, [userHabits]);

    const { styles } = themeHabits;

    const renderHero = (data: IDailyStreakCalendar) => (
        <View style={styles.dailyStreakHero}>
            <View style={styles.dailyStreakHeroText}>
                <Text
                    style={styles.dailyStreakHeroNumber}
                    accessibilityLabel={translate('pages.dailyStreak.currentAccessibility', { count: data.currentStreak })}
                >
                    {data.currentStreak}
                </Text>
                <Text style={styles.dailyStreakHeroLabel}>
                    {translate(data.currentStreak === 1 ? 'pages.dailyStreak.dayStreak' : 'pages.dailyStreak.daysStreak')}
                </Text>
                <Text style={styles.dailyStreakHeroSubtext}>
                    {translate('pages.dailyStreak.longest', { count: data.longestStreak })}
                </Text>
            </View>
            <Text style={styles.dailyStreakHeroGlyph} accessibilityElementsHidden importantForAccessibility="no">
                {STREAK_GLYPH}
            </Text>
        </View>
    );

    const renderFreezePips = (remaining: number, total: number) => {
        const rendered = Math.min(total, MAX_RENDERED_FREEZE_PIPS);
        const overflow = total - rendered;
        return (
            <View
                style={styles.streakFreezePipRow}
                accessibilityRole="image"
                accessibilityLabel={translate('pages.habits.streak.freezePipsAccessibility', { remaining, total })}
            >
                {Array.from({ length: rendered }, (_unused, index) => (
                    <View
                        key={index}
                        style={[
                            styles.streakFreezePip,
                            index < remaining ? styles.streakFreezePipAvailable : styles.streakFreezePipSpent,
                        ]}
                    >
                        <Text style={styles.streakFreezePipText}>{FREEZE_GLYPH}</Text>
                    </View>
                ))}
                {overflow > 0 && (
                    <Text style={styles.streakFreezeOverflowText}>{`+${overflow}`}</Text>
                )}
            </View>
        );
    };

    const renderFreezes = (data: IDailyStreakCalendar) => {
        const { remaining, total, habits } = data.freezes;
        let title: string;
        if (remaining > 0) {
            title = translate(remaining === 1 ? 'pages.dailyStreak.freezes.haveOne' : 'pages.dailyStreak.freezes.haveMany', {
                count: remaining,
            });
        } else {
            title = translate(total > 0 ? 'pages.dailyStreak.freezes.outOf' : 'pages.dailyStreak.freezes.none');
        }

        return (
            <View style={styles.dailyStreakCard}>
                <View style={styles.dailyStreakFreezeHeader}>
                    <Text style={styles.dailyStreakFreezeGlyph} accessibilityElementsHidden importantForAccessibility="no">
                        {FREEZE_GLYPH}
                    </Text>
                    <View style={styles.dailyStreakFreezeHeaderText}>
                        <Text style={styles.dailyStreakFreezeTitle}>{title}</Text>
                        <Text style={styles.dailyStreakFreezeBody}>
                            {translate(remaining > 0 ? 'pages.dailyStreak.freezes.coverRule' : 'pages.dailyStreak.freezes.earnRule')}
                        </Text>
                    </View>
                </View>
                {habits.map((habit) => {
                    const known = habitNames[habit.habitGoalId];
                    return (
                        <View key={habit.habitGoalId} style={styles.dailyStreakFreezeHabitRow}>
                            {!!known?.emoji && <Text style={styles.weeklyRecapHabitEmoji}>{known.emoji}</Text>}
                            <Text style={styles.dailyStreakFreezeHabitName} numberOfLines={1}>
                                {known?.name || translate('pages.dailyStreak.freezes.unknownHabit')}
                            </Text>
                            {renderFreezePips(habit.remaining, habit.total)}
                        </View>
                    );
                })}
            </View>
        );
    };

    const renderCalendar = (data: IDailyStreakCalendar) => {
        const canGoBack = data.hasPreviousMonth;
        const canGoForward = data.month < data.today.slice(0, 7);
        return (
            <>
                <Text style={styles.dailyStreakSectionTitle}>
                    {translate('pages.dailyStreak.calendarTitle')}
                </Text>
                <View style={styles.dailyStreakCard}>
                    <View style={styles.calendarHeader}>
                        <Pressable
                            accessibilityRole="button"
                            accessibilityLabel={translate('pages.dailyStreak.previousMonth')}
                            accessibilityState={{ disabled: !canGoBack }}
                            disabled={!canGoBack}
                            style={({ pressed }) => [
                                styles.calendarNavButton,
                                !canGoBack && styles.weeklyRecapNavButtonDisabled,
                                pressed && styles.pressedOpacity,
                            ]}
                            onPress={() => goToMonth(-1)}
                        >
                            <MaterialIcon name="chevron-left" size={24} color={themeHabits.colors.onSurface} />
                        </Pressable>
                        <Text style={styles.calendarTitle}>
                            {translate('pages.habits.calendarMonthYear', {
                                month: translate(`dateTime.months.${MONTH_KEYS[getMonthIndex(data.month)]}`),
                                year: data.month.slice(0, 4),
                            })}
                        </Text>
                        <Pressable
                            accessibilityRole="button"
                            accessibilityLabel={translate('pages.dailyStreak.nextMonth')}
                            accessibilityState={{ disabled: !canGoForward }}
                            disabled={!canGoForward}
                            style={({ pressed }) => [
                                styles.calendarNavButton,
                                !canGoForward && styles.weeklyRecapNavButtonDisabled,
                                pressed && styles.pressedOpacity,
                            ]}
                            onPress={() => goToMonth(1)}
                        >
                            <MaterialIcon name="chevron-right" size={24} color={themeHabits.colors.onSurface} />
                        </Pressable>
                    </View>
                    <DailyStreakCalendar
                        days={data.days}
                        themeHabits={themeHabits}
                        translate={translate}
                    />
                    <View style={styles.dailyStreakLegend}>
                        <View style={styles.dailyStreakLegendItem}>
                            <View style={[styles.dailyStreakLegendSwatch, styles.dailyStreakDayUpheld]} />
                            <Text style={styles.dailyStreakLegendText}>{translate('pages.dailyStreak.legend.upheld')}</Text>
                        </View>
                        <View style={styles.dailyStreakLegendItem}>
                            <View style={[styles.dailyStreakLegendSwatch, styles.dailyStreakDayFrozen]} />
                            <Text style={styles.dailyStreakLegendText}>{translate('pages.dailyStreak.legend.frozen')}</Text>
                        </View>
                        <View style={styles.dailyStreakLegendItem}>
                            <View style={[styles.dailyStreakLegendSwatch, styles.dailyStreakLegendSwatchMissed]} />
                            <Text style={styles.dailyStreakLegendText}>{translate('pages.dailyStreak.legend.missed')}</Text>
                        </View>
                        <View style={styles.dailyStreakLegendItem}>
                            <View style={[styles.dailyStreakLegendSwatch, styles.dailyStreakLegendSwatchRest]} />
                            <Text style={styles.dailyStreakLegendText}>{translate('pages.dailyStreak.legend.rest')}</Text>
                        </View>
                    </View>
                    {data.freezesUsedThisMonth > 0 && (
                        <Text style={styles.dailyStreakMonthSummary}>
                            {translate(
                                data.freezesUsedThisMonth === 1
                                    ? 'pages.dailyStreak.freezesUsedOne'
                                    : 'pages.dailyStreak.freezesUsedMany',
                                { count: data.freezesUsedThisMonth },
                            )}
                        </Text>
                    )}
                </View>
            </>
        );
    };

    return (
        <SafeAreaView edges={[]} style={[theme.styles.safeAreaView, styles.weeklyRecapContainer]}>
            <BaseStatusBar therrThemeName={themeName} />
            {/* No `theme.styles.scrollView` here: its `marginBottom: buttonMenuHeight` stops the
                scroll area a full menu-height above the (absolutely positioned) MainButtonMenu,
                leaving a gray band. The content padding below already clears the menu. */}
            <ScrollView
                contentContainerStyle={{ paddingBottom: buttonMenuHeight + 16 }}
                refreshControl={<RefreshControl refreshing={isLoading && hasFetched} onRefresh={onRefresh} />}
            >
                {!hasFetched && (
                    <View style={styles.weeklyRecapHeader}>
                        <HabitsListLoader label={translate('pages.dailyStreak.loading')} theme={themeHabits} />
                    </View>
                )}

                {hasFetched && !calendar && (
                    <View style={styles.dailyStreakCard}>
                        <Text style={styles.weeklyRecapEmptyText}>
                            {translate(hasError ? 'pages.dailyStreak.loadFailed' : 'pages.dailyStreak.empty')}
                        </Text>
                    </View>
                )}

                {!!calendar && renderHero(calendar)}
                {!!calendar && renderFreezes(calendar)}
                {!!calendar && renderCalendar(calendar)}
                {!!calendar && hasError && (
                    <Text style={styles.dailyStreakMonthSummary}>{translate('pages.dailyStreak.loadFailed')}</Text>
                )}
            </ScrollView>
            <MainButtonMenu
                navigation={navigation}
                onActionButtonPress={onRefresh}
                translate={translate}
                user={user}
                themeMenu={themeMenu}
            />
        </SafeAreaView>
    );
};

export default DailyStreak;
