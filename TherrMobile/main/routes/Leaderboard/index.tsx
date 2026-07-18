import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';
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
import { getUserImageUri } from '../../utilities/content';
import { buildStyles } from '../../styles';
import { buildStyles as buildMenuStyles } from '../../styles/navigation/buttonMenu';
import { buildStyles as buildLeaderboardStyles, MEDAL_COLORS } from '../../styles/leaderboard';

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
    const [isRefreshing, setIsRefreshing] = useState(false);

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
            setEntries(response?.data?.entries || []);
            setCurrentUser(response?.data?.currentUser || null);
            setPeriodEnd(response?.data?.periodEnd || null);
        }).catch(() => {
            // Offline/network errors leave the previous board visible (offline-first pattern)
        }).finally(() => {
            setIsRefreshing(false);
        });
    }, []);

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

    return (
        <>
            <BaseStatusBar therrThemeName={user.settings?.mobileThemeName} />
            <SafeAreaView edges={[]} style={[theme.styles.safeAreaView, { backgroundColor: theme.colors.backgroundGray }]}>
                <View style={[theme.styles.body, { backgroundColor: theme.colors.backgroundGray }]}>
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
                                <Text style={themeLeaderboard.styles.emptyText}>
                                    {translate(scope === 'connections'
                                        ? 'pages.leaderboard.info.noFriendScores'
                                        : 'pages.leaderboard.info.noScores')}
                                </Text>
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

export default connect(mapStateToProps)(Leaderboard);
