import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, Text, View } from 'react-native';
import { RefreshControl } from 'react-native-gesture-handler';
import { SafeAreaView } from 'react-native-safe-area-context';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import { UsersService } from 'therr-react/services';
import { HabitActions } from 'therr-react/redux/actions';
import { IDailyStreakPendingPlacement, IUserState } from 'therr-react/types';
import FontAwesome5Icon from 'react-native-vector-icons/FontAwesome5';
import { Avatar } from '../../components/BaseAvatar';
import MainButtonMenu from '../../components/ButtonMenu/MainButtonMenu';
import BaseStatusBar from '../../components/BaseStatusBar';
import translator from '../../utilities/translator';
import { showToast } from '../../utilities/toasts';
import { getUserImageUri } from '../../utilities/content';
import { buildStyles } from '../../styles';
import { buildStyles as buildMenuStyles } from '../../styles/navigation/buttonMenu';
import { buildStyles as buildLeaderboardStyles, MEDAL_COLORS } from '../../styles/leaderboard';
import { buildStyles as buildCelebrationStyles } from '../../styles/celebrations';
import { PODIUM_PLACEMENT_MAX } from '../../utilities/celebrationQueue';

const PAGE_SIZE = 50;

type ILeaderboardPeriod = 'week' | 'allTime';
type ILeaderboardScope = 'global' | 'connections';

interface ILeaderboardEntry {
    userId: string;
    userName: string;
    firstName?: string;
    lastName?: string;
    media?: any;
    points: number;
    rank: number;
    isRequestingUser: boolean;
    /** App-level daily streak, for the 🔥 chip. 0 means no chip. */
    dailyStreak?: number;
}

interface ILeaderboardProps {
    navigation: any;
    user: IUserState;
    /**
     * Unacknowledged end-of-period placements, loaded by the daily-streak fetch on app
     * foreground. Podium finishes get a full-screen celebration instead; anything below shows
     * as the dismissible card at the top of this board.
     */
    pendingPlacements: IDailyStreakPendingPlacement[];
    acknowledgePlacement: Function;
}

const mapStateToProps = (state: any) => ({
    user: state.user,
    pendingPlacements: state.habits?.dailyStreak?.pendingPlacements || [],
});

const mapDispatchToProps = (dispatch: any) => bindActionCreators({
    acknowledgePlacement: HabitActions.acknowledgePlacement,
}, dispatch);

const getDaysUntilReset = (periodEnd: string | null): number => {
    if (!periodEnd) {
        return 0;
    }
    const msRemaining = new Date(`${periodEnd}T00:00:00Z`).getTime() - Date.now();
    return Math.max(1, Math.ceil(msRemaining / (24 * 60 * 60 * 1000)));
};

export const Leaderboard = ({
    navigation,
    user,
    pendingPlacements,
    acknowledgePlacement,
}: ILeaderboardProps) => {
    const [entries, setEntries] = useState<ILeaderboardEntry[]>([]);
    const [currentUser, setCurrentUser] = useState<{ userId: string; points: number; rank: number } | null>(null);
    const [periodEnd, setPeriodEnd] = useState<string | null>(null);
    const [period, setPeriod] = useState<ILeaderboardPeriod>('week');
    const [scope, setScope] = useState<ILeaderboardScope>('global');
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
    const isMountedRef = useRef(true);

    useEffect(() => () => {
        isMountedRef.current = false;
    }, []);

    const theme = useMemo(() => buildStyles(user.settings?.mobileThemeName), [user.settings?.mobileThemeName]);
    const themeMenu = useMemo(() => buildMenuStyles(user.settings?.mobileThemeName), [user.settings?.mobileThemeName]);
    const themeLeaderboard = useMemo(
        () => buildLeaderboardStyles(user.settings?.mobileThemeName),
        [user.settings?.mobileThemeName],
    );
    const themeCelebration = useMemo(
        () => buildCelebrationStyles(user.settings?.mobileThemeName),
        [user.settings?.mobileThemeName],
    );
    const translate = useCallback(
        (key: string, params?: any) => translator(user.settings?.locale || 'en-us', key, params),
        [user.settings?.locale],
    );

    const fetchLeaderboard = useCallback((nextPeriod: ILeaderboardPeriod, nextScope: ILeaderboardScope) => {
        setIsRefreshing(true);
        return UsersService.getLeaderboard({
            period: nextPeriod,
            scope: nextScope,
            limit: PAGE_SIZE,
        }).then((response: any) => {
            if (!isMountedRef.current) {
                return;
            }
            // The axios interceptor resolves transient/offline GET failures with
            // `{ data: {}, isOfflineFallback: true }` — keep the last board visible
            // instead of clobbering it with an empty response (offline-first pattern).
            if (response?.isOfflineFallback || !Array.isArray(response?.data?.entries)) {
                return;
            }
            setEntries(response.data.entries);
            setCurrentUser(response.data.currentUser || null);
            setPeriodEnd(response.data.periodEnd || null);
        }).catch(() => {
            // Non-transient server errors (transient ones resolve via the interceptor
            // fallback above). Keep the previous board and let the user know.
            if (isMountedRef.current) {
                showToast.error({
                    text1: translate('alertTitles.backendErrorMessage'),
                    text2: translate('alertMessages.backendErrorMessage'),
                });
            }
        }).finally(() => {
            if (isMountedRef.current) {
                setIsRefreshing(false);
                setHasLoadedOnce(true);
            }
        });
    }, [translate]);

    useEffect(() => {
        navigation.setOptions({
            title: translate('pages.leaderboard.headerTitle'),
        });
    }, [navigation, translate]);

    useEffect(() => {
        fetchLeaderboard(period, scope);
    }, [fetchLeaderboard, period, scope]);

    const goToViewUser = (userId: string) => {
        if (userId === user.details?.id) {
            return;
        }
        navigation.navigate('ViewUser', {
            userInView: {
                id: userId,
            },
        });
    };

    const renderRank = (rank: number) => {
        if (rank <= MEDAL_COLORS.length) {
            return (
                <FontAwesome5Icon
                    name="medal"
                    size={20}
                    color={MEDAL_COLORS[rank - 1]}
                />
            );
        }
        return (
            <Text style={themeLeaderboard.styles.rankText}>{rank}</Text>
        );
    };

    const renderItem = ({ item }: { item: ILeaderboardEntry }) => (
        <Pressable
            onPress={() => goToViewUser(item.userId)}
            style={[
                themeLeaderboard.styles.rowContainer,
                item.isRequestingUser ? themeLeaderboard.styles.rowContainerHighlighted : null,
            ]}
        >
            <View style={themeLeaderboard.styles.rankContainer}>
                {renderRank(item.rank)}
            </View>
            <Avatar
                title={`${item.firstName?.substring(0, 1) || ''}${item.lastName?.substring(0, 1) || ''}`}
                rounded
                source={{
                    uri: getUserImageUri({ details: item }, 100),
                }}
                size="small"
            />
            <Text style={themeLeaderboard.styles.userNameText} numberOfLines={1}>
                {item.isRequestingUser ? translate('pages.leaderboard.labels.you') : item.userName}
            </Text>
            {item.dailyStreak ? (
                <View
                    style={themeCelebration.styles.streakChip}
                    accessibilityLabel={translate('pages.leaderboard.labels.dailyStreakAccessibility', {
                        count: item.dailyStreak,
                    })}
                >
                    <FontAwesome5Icon name="fire" size={12} color={themeCelebration.colors.brandingOrange} />
                    <Text style={themeCelebration.styles.streakChipText}>{item.dailyStreak}</Text>
                </View>
            ) : null}
            <Text style={themeLeaderboard.styles.pointsText}>
                {translate('pages.leaderboard.labels.xpPoints', { points: item.points })}
            </Text>
        </Pressable>
    );

    const renderTab = (
        labelKey: string,
        isActive: boolean,
        onPress: () => void,
    ) => (
        <Pressable
            onPress={onPress}
            style={[
                themeLeaderboard.styles.tab,
                isActive ? themeLeaderboard.styles.tabActive : null,
            ]}
        >
            <Text
                style={[
                    themeLeaderboard.styles.tabText,
                    isActive ? themeLeaderboard.styles.tabTextActive : null,
                ]}
            >
                {translate(labelKey)}
            </Text>
        </Pressable>
    );

    const isCurrentUserVisible = entries.some((entry) => entry.isRequestingUser);

    // A podium finish gets the full-screen celebration (queued on app foreground), so only the
    // rest land here. Newest first, and only the first one: a stack of cards above the board is
    // the wall of modals this was meant to avoid, in a different shape.
    const inlinePlacement = pendingPlacements
        .filter((placement) => placement.placement > PODIUM_PLACEMENT_MAX)[0];

    const renderInlinePlacement = () => {
        if (!inlinePlacement) {
            return null;
        }

        return (
            <View style={themeCelebration.styles.placementCard}>
                <FontAwesome5Icon name="medal" size={20} color={themeCelebration.colors.textWhite} />
                <View style={themeCelebration.styles.placementCardTextContainer}>
                    <Text style={themeCelebration.styles.placementCardTitle}>
                        {translate('pages.leaderboard.placementCard.title', {
                            placement: inlinePlacement.placement,
                            participants: inlinePlacement.participants,
                        })}
                    </Text>
                    <Text style={themeCelebration.styles.placementCardSubtitle}>
                        {translate('pages.leaderboard.placementCard.subtitle', {
                            period: inlinePlacement.periodStart,
                            score: inlinePlacement.score,
                        })}
                    </Text>
                </View>
                <Pressable
                    onPress={() => acknowledgePlacement(inlinePlacement.periodId)?.catch?.(() => {})}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel={translate('pages.leaderboard.placementCard.dismiss')}
                    style={themeCelebration.styles.placementCardDismiss}
                >
                    <FontAwesome5Icon name="times" size={16} color={themeCelebration.colors.textWhite} />
                </Pressable>
            </View>
        );
    };

    return (
        <>
            <BaseStatusBar therrThemeName={user.settings?.mobileThemeName} />
            <SafeAreaView edges={[]} style={[theme.styles.safeAreaView, { backgroundColor: theme.colors.backgroundGray }]}>
                <View style={[theme.styles.body, { backgroundColor: theme.colors.backgroundGray }]}>
                    {renderInlinePlacement()}
                    <View style={themeLeaderboard.styles.tabsContainer}>
                        {renderTab('pages.leaderboard.tabs.thisWeek', period === 'week', () => setPeriod('week'))}
                        {renderTab('pages.leaderboard.tabs.allTime', period === 'allTime', () => setPeriod('allTime'))}
                    </View>
                    <View style={themeLeaderboard.styles.tabsContainer}>
                        {renderTab('pages.leaderboard.tabs.everyone', scope === 'global', () => setScope('global'))}
                        {renderTab('pages.leaderboard.tabs.friends', scope === 'connections', () => setScope('connections'))}
                    </View>
                    {
                        period === 'week' && !!periodEnd
                        && <Text style={themeLeaderboard.styles.resetCountdownText}>
                            {translate('pages.leaderboard.labels.resetsIn', { days: getDaysUntilReset(periodEnd) })}
                        </Text>
                    }
                    <FlatList
                        data={entries}
                        keyExtractor={(item) => item.userId}
                        renderItem={renderItem}
                        refreshControl={<RefreshControl
                            refreshing={isRefreshing}
                            onRefresh={() => fetchLeaderboard(period, scope)}
                        />}
                        ListEmptyComponent={
                            <View style={themeLeaderboard.styles.emptyContainer}>
                                {
                                    hasLoadedOnce
                                        ? <Text style={themeLeaderboard.styles.emptyText}>
                                            {translate(scope === 'connections'
                                                ? 'pages.leaderboard.info.noFriendScores'
                                                : 'pages.leaderboard.info.noScores')}
                                        </Text>
                                        : <ActivityIndicator size="large" color={theme.colors.primary3} />
                                }
                            </View>
                        }
                    />
                    {
                        !isCurrentUserVisible && !!currentUser
                        && <View style={themeLeaderboard.styles.currentUserBar}>
                            <Text style={themeLeaderboard.styles.currentUserBarText}>
                                {translate('pages.leaderboard.labels.yourRank', {
                                    rank: currentUser.rank,
                                })}
                            </Text>
                            <Text style={themeLeaderboard.styles.pointsText}>
                                {translate('pages.leaderboard.labels.xpPoints', { points: currentUser.points })}
                            </Text>
                        </View>
                    }
                </View>
            </SafeAreaView>
            <MainButtonMenu
                navigation={navigation}
                onActionButtonPress={() => fetchLeaderboard(period, scope)}
                translate={translate}
                user={user}
                themeMenu={themeMenu}
            />
        </>
    );
};

export default connect(mapStateToProps, mapDispatchToProps)(Leaderboard);
