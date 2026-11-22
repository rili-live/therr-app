import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, Text, View } from 'react-native';
import { RefreshControl } from 'react-native-gesture-handler';
import { SafeAreaView } from 'react-native-safe-area-context';
import { connect } from 'react-redux';
import MaterialIcon from 'react-native-vector-icons/MaterialIcons';
import { DropsService, IDrop } from 'therr-react/services';
import { IUserState } from 'therr-react/types';
import MainButtonMenu from '../../components/ButtonMenu/MainButtonMenu';
import BaseStatusBar from '../../components/BaseStatusBar';
import { Button } from '../../components/BaseButton';
import translator from '../../utilities/translator';
import { showToast } from '../../utilities/toasts';
import { buildStyles } from '../../styles';
import { buildStyles as buildMenuStyles } from '../../styles/navigation/buttonMenu';
import { buildStyles as buildDropsStyles } from '../../styles/drops';
import { formatDropDay, getDropUserName } from './dropDisplay';

type IDropsTab = 'received' | 'sent';

interface IDropsProps {
    navigation: any;
    route: any;
    user: IUserState;
}

const mapStateToProps = (state: any) => ({
    user: state.user,
});

/**
 * Drops inbox (docs/DROPS.md): what friends have left for this user, and what this user has
 * left for them. The drop itself — locked or open — is ViewDrop.
 */
export const Drops = ({ navigation, route, user }: IDropsProps) => {
    const [tab, setTab] = useState<IDropsTab>(route?.params?.activeTab === 'sent' ? 'sent' : 'received');
    const [dropsByTab, setDropsByTab] = useState<Record<IDropsTab, IDrop[]>>({ received: [], sent: [] });
    const [loadedTabs, setLoadedTabs] = useState<Record<IDropsTab, boolean>>({ received: false, sent: false });
    const [isRefreshing, setIsRefreshing] = useState(false);
    const isMountedRef = useRef(true);

    useEffect(() => () => {
        isMountedRef.current = false;
    }, []);

    const theme = useMemo(() => buildStyles(user.settings?.mobileThemeName), [user.settings?.mobileThemeName]);
    const themeMenu = useMemo(() => buildMenuStyles(user.settings?.mobileThemeName), [user.settings?.mobileThemeName]);
    const themeDrops = useMemo(() => buildDropsStyles(user.settings?.mobileThemeName), [user.settings?.mobileThemeName]);
    const locale = user.settings?.locale || 'en-us';
    const translate = useCallback(
        (key: string, params?: any) => translator(locale, key, params),
        [locale],
    );

    const fetchDrops = useCallback((nextTab: IDropsTab) => {
        setIsRefreshing(true);
        const request = nextTab === 'sent' ? DropsService.getSent() : DropsService.getReceived();
        return request.then((response: any) => {
            if (!isMountedRef.current) {
                return;
            }
            // Offline fallback resolves with an empty body: keep what is already on screen.
            if (response?.isOfflineFallback || !Array.isArray(response?.data?.drops)) {
                return;
            }
            setDropsByTab((prev) => ({ ...prev, [nextTab]: response.data.drops }));
        }).catch(() => {
            if (isMountedRef.current) {
                showToast.error({
                    text1: translate('alertTitles.backendErrorMessage'),
                    text2: translate('alertMessages.backendErrorMessage'),
                });
            }
        }).finally(() => {
            if (isMountedRef.current) {
                setIsRefreshing(false);
                setLoadedTabs((prev) => ({ ...prev, [nextTab]: true }));
            }
        });
    }, [translate]);

    useEffect(() => {
        navigation.setOptions({
            title: translate('pages.drops.headerTitle'),
        });
    }, [navigation, translate]);

    // Refetch on focus, so a drop opened or left on another screen shows its new state on return.
    useEffect(() => {
        fetchDrops(tab);
        const unsubscribe = navigation.addListener('focus', () => fetchDrops(tab));
        return unsubscribe;
    }, [fetchDrops, navigation, tab]);

    const goToDrop = (drop: IDrop) => {
        navigation.navigate('ViewDrop', { dropId: drop.id });
    };

    const goToCreate = () => {
        navigation.navigate('CreateDrop', {});
    };

    const renderStatus = (drop: IDrop) => {
        const isOpened = drop.status === 'opened';
        let label = translate('pages.drops.status.locked');
        if (isOpened) {
            label = drop.openedOn
                ? translate('pages.drops.status.openedOn', { date: formatDropDay(drop.openedOn, locale) })
                : translate('pages.drops.status.opened');
        } else if (drop.status === 'expired') {
            label = translate('pages.drops.status.expired');
        }

        return (
            <View style={[themeDrops.styles.statusPill, isOpened ? themeDrops.styles.statusPillOpened : null]}>
                <Text style={[themeDrops.styles.statusPillText, isOpened ? themeDrops.styles.statusPillTextOpened : null]}>
                    {label}
                </Text>
            </View>
        );
    };

    const renderItem = ({ item }: { item: IDrop }) => {
        const otherUserName = getDropUserName(item.isSender ? item.toUser : item.fromUser);
        let iconName = 'lock';
        if (item.status === 'opened') {
            iconName = 'lock-open';
        } else if (item.status === 'expired') {
            iconName = 'hourglass-empty';
        }

        return (
            <Pressable
                onPress={() => goToDrop(item)}
                style={themeDrops.styles.card}
                accessibilityRole="button"
            >
                <View style={themeDrops.styles.cardIcon}>
                    <MaterialIcon name={iconName} size={22} color={themeDrops.colors.brand} />
                </View>
                <View style={themeDrops.styles.cardBody}>
                    <Text style={themeDrops.styles.cardTitle} numberOfLines={1}>
                        {translate(item.isSender ? 'pages.drops.labels.forUser' : 'pages.drops.labels.fromUser', {
                            userName: otherUserName,
                        })}
                    </Text>
                    <Text style={themeDrops.styles.cardSubtitle} numberOfLines={1}>
                        {item.placeName || translate('pages.drops.labels.aSpotTheyPicked')}
                    </Text>
                </View>
                {renderStatus(item)}
            </Pressable>
        );
    };

    const renderTab = (tabKey: IDropsTab) => (
        <Pressable
            onPress={() => setTab(tabKey)}
            style={[themeDrops.styles.tab, tab === tabKey ? themeDrops.styles.tabActive : null]}
        >
            <Text style={[themeDrops.styles.tabText, tab === tabKey ? themeDrops.styles.tabTextActive : null]}>
                {translate(`pages.drops.tabs.${tabKey}`)}
            </Text>
        </Pressable>
    );

    const renderEmpty = () => {
        if (!loadedTabs[tab]) {
            return (
                <View style={themeDrops.styles.emptyContainer}>
                    <ActivityIndicator size="large" color={themeDrops.colors.brand} />
                </View>
            );
        }

        return (
            <View style={themeDrops.styles.emptyContainer}>
                <MaterialIcon name="place" size={48} color={themeDrops.colors.brand} />
                <Text style={themeDrops.styles.emptyTitle}>
                    {translate(tab === 'sent' ? 'pages.drops.info.noSentTitle' : 'pages.drops.info.noReceivedTitle')}
                </Text>
                <Text style={themeDrops.styles.emptyText}>
                    {translate(tab === 'sent' ? 'pages.drops.info.noSentBody' : 'pages.drops.info.noReceivedBody')}
                </Text>
            </View>
        );
    };

    return (
        <>
            <BaseStatusBar therrThemeName={user.settings?.mobileThemeName} />
            <SafeAreaView edges={[]} style={[theme.styles.safeAreaView, themeDrops.styles.body]}>
                <View style={[theme.styles.body, themeDrops.styles.body]}>
                    <View style={themeDrops.styles.tabsContainer}>
                        {renderTab('received')}
                        {renderTab('sent')}
                    </View>
                    <FlatList
                        data={dropsByTab[tab]}
                        keyExtractor={(item) => item.id}
                        renderItem={renderItem}
                        contentContainerStyle={themeDrops.styles.listContent}
                        refreshControl={<RefreshControl
                            refreshing={isRefreshing}
                            onRefresh={() => fetchDrops(tab)}
                        />}
                        ListHeaderComponent={
                            <View style={themeDrops.styles.listHeader}>
                                <Button
                                    title={translate('pages.drops.buttons.leaveADrop')}
                                    variant="primary"
                                    size="md"
                                    shape="pill"
                                    onPress={goToCreate}
                                    icon={
                                        <MaterialIcon
                                            name="add-location-alt"
                                            size={20}
                                            color={themeDrops.colors.onBrand}
                                            style={themeDrops.styles.buttonIcon}
                                        />
                                    }
                                />
                            </View>
                        }
                        ListEmptyComponent={renderEmpty()}
                    />
                </View>
            </SafeAreaView>
            <MainButtonMenu
                navigation={navigation}
                onActionButtonPress={() => fetchDrops(tab)}
                translate={translate}
                user={user}
                themeMenu={themeMenu}
            />
        </>
    );
};

export default connect(mapStateToProps)(Drops);
