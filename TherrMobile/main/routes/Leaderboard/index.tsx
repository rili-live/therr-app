import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, Text, View } from 'react-native';
import { RefreshControl } from 'react-native-gesture-handler';
import { SafeAreaView } from 'react-native-safe-area-context';
import { connect } from 'react-redux';
import { UsersService } from 'therr-react/services';
import { IUserState } from 'therr-react/types';
import FontAwesome5Icon from 'react-native-vector-icons/FontAwesome5';
import { Avatar } from '../../components/BaseAvatar';
import MainButtonMenu from '../../components/ButtonMenu/MainButtonMenu';
import BaseStatusBar from '../../components/BaseStatusBar';
import translator from '../../utilities/translator';
import { showToast } from '../../utilities/toasts';
import { getUserImageUri } from '../../utilities/content';
import { buildStyles } from '../../styles';
import { buildStyles as buildMenuStyles } from '../../styles/navigation/buttonMenu';
import { buildStyles as buildLeaderboardStyles, LEAGUE_ZONE_COLORS, MEDAL_COLORS } from '../../styles/leaderboard';
import { CURRENT_BRAND_VARIATION } from '../../config/brandConfig';
import LeagueHeader from './LeagueHeader';
import { ILeaderboardLeague, getLeagueZone, getTier, getTierNameKey } from './leagues';

const PAGE_SIZE = 50;

type ILeaderboardPeriod = 'week' | 'allTime';
// 'league' ranks the requester's own tier; the server answers it with the global board (and says
// so in the response's `scope`) whenever leagues are not running for the brand.
type ILeaderboardScope = 'global' | 'connections' | 'league';

interface ILeaderboardEntry {
    userId: string;
    userName: string;
    firstName?: string;
    lastName?: string;
    media?: any;
    points: number;
    rank: number;
    isRequestingUser: boolean;
    /** Stored tier id; null means the lowest tier. Absent on servers that predate leagues. */
    league?: string | null;
}

interface ILeaderboardProps {
    navigation: any;
    user: IUserState;
}

const mapStateToProps = (state: any) => ({
    user: state.user,
});

const getDaysUntilReset = (periodEnd: string | null): number => {
    if (!periodEnd) {
        return 0;
    }
    const msRemaining = new Date(`${periodEnd}T00:00:00Z`).getTime() - Date.now();
    return Math.max(1, Math.ceil(msRemaining / (24 * 60 * 60 * 1000)));
};

export const Leaderboard = ({ navigation, user }: ILeaderboardProps) => {
    const [entries, setEntries] = useState<ILeaderboardEntry[]>([]);
    const [currentUser, setCurrentUser] = useState<{ userId: string; points: number; rank: number } | null>(null);
    const [periodEnd, setPeriodEnd] = useState<string | null>(null);
    const [period, setPeriod] = useState<ILeaderboardPeriod>('week');
    const [scope, setScope] = useState<ILeaderboardScope>('global');
    const [league, setLeague] = useState<ILeaderboardLeague | null>(null);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
    const isMountedRef = useRef(true);
    // Leagues open on the user's own league the first time the server says one is running, once
    // per visit — after that the tabs are the user's to choose.
    const hasPickedInitialScopeRef = useRef(false);

    useEffect(() => () => {
        isMountedRef.current = false;
    }, []);

    const theme = useMemo(() => buildStyles(user.settings?.mobileThemeName), [user.settings?.mobileThemeName]);
    const themeMenu = useMemo(() => buildMenuStyles(user.settings?.mobileThemeName), [user.settings?.mobileThemeName]);
    const themeLeaderboard = useMemo(
        () => buildLeaderboardStyles(user.settings?.mobileThemeName),
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
            const nextLeague: ILeaderboardLeague | null = response.data.league || null;
            setLeague(nextLeague);
            if (!hasPickedInitialScopeRef.current) {
                hasPickedInitialScopeRef.current = true;
                if (nextLeague && nextScope === 'global') {
                    setPeriod('week');
                    setScope('league');
                    return;
                }
            }
            // Asked for a league that is not running (it ended, or this brand never had one): the
            // server served the global board, so the tabs should say so too.
            if (nextScope === 'league' && response.data.scope && response.data.scope !== 'league') {
                setScope(response.data.scope);
            }
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

    // On the mixed boards (everyone, friends), each row wears its tier so the ladder is visible
    // across leagues. On the league board everyone shares one tier, so the badge would be noise.
    const renderTierBadge = (item: ILeaderboardEntry) => {
        if (!league || scope === 'league' || item.league === undefined) {
            return null;
        }
        const tier = getTier(CURRENT_BRAND_VARIATION, item.league);
        if (!tier) {
            return null;
        }
        return (
            <Text
                style={themeLeaderboard.styles.tierBadge}
                accessibilityLabel={translate('pages.leaderboard.leagues.title', {
                    tier: translate(getTierNameKey(CURRENT_BRAND_VARIATION, tier.id)),
                })}
            >
                {tier.emoji}
            </Text>
        );
    };

    const renderZoneIndicator = (rank: number) => {
        if (scope !== 'league') {
            return null;
        }
        const zone = getLeagueZone(rank, league);
        return (
            <View style={themeLeaderboard.styles.leagueZoneIndicator}>
                {
                    zone
                    && <FontAwesome5Icon
                        name={zone === 'promote' ? 'arrow-up' : 'arrow-down'}
                        size={12}
                        color={LEAGUE_ZONE_COLORS[zone]}
                        accessibilityLabel={translate(zone === 'promote'
                            ? 'pages.leaderboard.leagues.promotionZoneAccessibility'
                            : 'pages.leaderboard.leagues.demotionZoneAccessibility')}
                    />
                }
            </View>
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
                    uri: getUserImageUri({ details: { id: item.userId, media: item.media } }, 100),
                }}
                size="small"
            />
            <Text style={themeLeaderboard.styles.userNameText} numberOfLines={1}>
                {item.isRequestingUser ? translate('pages.leaderboard.labels.you') : item.userName}
            </Text>
            {renderTierBadge(item)}
            <Text style={themeLeaderboard.styles.pointsText}>
                {translate('pages.leaderboard.labels.xpPoints', { points: item.points })}
            </Text>
            {renderZoneIndicator(item.rank)}
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

    // The league board is weekly only, so its header takes the place of the period tabs.
    const renderLeagueHeaderOrPeriodTabs = () => {
        if (scope === 'league' && league) {
            return (
                <LeagueHeader
                    brand={CURRENT_BRAND_VARIATION}
                    league={league}
                    themeLeaderboard={themeLeaderboard}
                    translate={translate}
                />
            );
        }
        return (
            <View style={themeLeaderboard.styles.tabsContainer}>
                {renderTab('pages.leaderboard.tabs.thisWeek', period === 'week', () => setPeriod('week'))}
                {renderTab('pages.leaderboard.tabs.allTime', period === 'allTime', () => setPeriod('allTime'))}
            </View>
        );
    };

    const isCurrentUserVisible = entries.some((entry) => entry.isRequestingUser);
    const isRankBarVisible = !isCurrentUserVisible && !!currentUser;

    return (
        <>
            <BaseStatusBar therrThemeName={user.settings?.mobileThemeName} />
            <SafeAreaView edges={[]} style={[theme.styles.safeAreaView, { backgroundColor: theme.colors.backgroundGray }]}>
                {/* flex: 1 bounds the body to the screen so the FlatList, not the body, absorbs the height of
                    the tabs, league header and reset countdown above it. Without it the list's last rows
                    overflow off-screen and can never be scrolled into view. */}
                <View style={[theme.styles.body, themeLeaderboard.styles.body, { backgroundColor: theme.colors.backgroundGray }]}>
                    <View style={themeLeaderboard.styles.tabsContainer}>
                        {
                            !!league
                            && renderTab('pages.leaderboard.tabs.myLeague', scope === 'league', () => {
                                // A league is a weekly competition: it has no all-time board.
                                setPeriod('week');
                                setScope('league');
                            })
                        }
                        {renderTab('pages.leaderboard.tabs.everyone', scope === 'global', () => setScope('global'))}
                        {renderTab('pages.leaderboard.tabs.friends', scope === 'connections', () => setScope('connections'))}
                    </View>
                    {renderLeagueHeaderOrPeriodTabs()}
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
                        contentContainerStyle={isRankBarVisible ? undefined : themeLeaderboard.styles.listContentContainer}
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
                        isRankBarVisible
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

export default connect(mapStateToProps)(Leaderboard);
