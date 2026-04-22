import React from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
    Alert,
    FlatList,
    RefreshControl,
    Share,
    StyleSheet,
    Switch,
    Text,
    TouchableOpacity,
    View} from 'react-native';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import { ContentActions } from 'therr-react/redux/actions';
import { slugify } from 'therr-js-utilities/slugify';
import MaterialIcon from 'react-native-vector-icons/MaterialIcons';
import BaseStatusBar from '../../components/BaseStatusBar';
import translator from '../../utilities/translator';
import { buildStyles } from '../../styles';
import { navToViewContent } from '../../utilities/postViewHelpers';
import { buildPublicListUrl } from '../../utilities/shareUrls';

interface IListDetailDispatchProps {
    fetchUserList: Function;
    deleteUserList: Function;
    updateUserList: Function;
}

interface IStoreProps extends IListDetailDispatchProps {
    content: any;
    user: any;
}

interface IListDetailProps extends IStoreProps {
    navigation: any;
    route: { params: { listId: string } };
}

interface IListDetailState {
    isLoading: boolean;
    isTogglingPublic: boolean;
}

const mapStateToProps = (state: any) => ({
    content: state.content,
    user: state.user,
});

const mapDispatchToProps = (dispatch: any) =>
    bindActionCreators(
        {
            fetchUserList: ContentActions.fetchUserList,
            deleteUserList: ContentActions.deleteUserList,
            updateUserList: ContentActions.updateUserList,
        },
        dispatch,
    );

class BookmarkListDetail extends React.Component<IListDetailProps, IListDetailState> {
    private translate: Function;
    private theme = buildStyles();

    constructor(props: IListDetailProps) {
        super(props);

        this.state = { isLoading: true, isTogglingPublic: false };

        this.theme = buildStyles(props.user.settings?.mobileThemeName);
        this.translate = (key: string, params?: any) =>
            translator(props.user.settings?.locale || 'en-us', key, params);
    }

    componentDidMount() {
        this.refresh();
        this.syncNavTitle();
    }

    componentDidUpdate(prevProps: IListDetailProps) {
        const prevName = prevProps.content?.activeUserList?.name;
        const currName = this.props.content?.activeUserList?.name;
        if (prevName !== currName) {
            this.syncNavTitle();
        }
    }

    syncNavTitle = () => {
        const { navigation, content } = this.props;
        const activeUserList = content?.activeUserList;
        if (activeUserList && navigation) {
            navigation.setOptions({ title: activeUserList.name });
        }
    };

    refresh = () => {
        const { fetchUserList, route } = this.props;
        this.setState({ isLoading: true });
        return fetchUserList(route.params.listId).finally(() => this.setState({ isLoading: false }));
    };

    goToSpace = (space: any) => {
        const { navigation, user } = this.props;
        navToViewContent({ ...space, areaType: 'spaces' }, user, navigation.navigate);
    };

    handleTogglePublic = (nextValue: boolean) => {
        const { content, route, updateUserList } = this.props;
        const list = content?.activeUserList;
        if (!list || list.id !== route.params.listId) return;
        this.setState({ isTogglingPublic: true });
        updateUserList(list.id, { isPublic: nextValue })
            .catch((err: any) => {
                Alert.alert(
                    this.translate('pages.bookmarks.lists.publicToggleErrorTitle'),
                    err?.response?.data?.message || this.translate('pages.bookmarks.lists.publicToggleErrorBody'),
                );
            })
            .finally(() => this.setState({ isTogglingPublic: false }));
    };

    handleShare = async () => {
        const { content, user } = this.props;
        const list = content?.activeUserList;
        if (!list) return;
        const locale = user?.settings?.locale || 'en-us';
        const url = buildPublicListUrl(locale, list.userId, slugify(list.name));
        try {
            await Share.share({
                message: this.translate('pages.bookmarks.lists.shareMessage', { listName: list.name, url }),
                url, // iOS only
                title: list.name, // Android only
            });
        } catch { /* noop */ }
    };

    handleDelete = () => {
        const { route, deleteUserList, navigation } = this.props;
        Alert.alert(
            this.translate('pages.bookmarks.lists.deleteList'),
            this.translate('pages.bookmarks.lists.deleteConfirm'),
            [
                { text: this.translate('pages.bookmarks.lists.cancel'), style: 'cancel' },
                {
                    text: this.translate('pages.bookmarks.lists.deleteList'),
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await deleteUserList(route.params.listId);
                            navigation.goBack();
                        } catch { /* noop */ }
                    },
                },
            ],
        );
    };

    render() {
        const { content, user } = this.props;
        const activeUserList = content?.activeUserList;
        const { isLoading, isTogglingPublic } = this.state;
        const spaces = activeUserList?.spaces || [];
        const items = activeUserList?.items || [];
        const isOwner = !!(activeUserList && user?.details?.id && activeUserList.userId === user.details.id);
        // Fall back to junction rows if the space lookup came back empty —
        // this surfaces that the list has content even when maps-service is
        // unreachable or a space was deleted.
        const rows = spaces.length
            ? spaces
            : items.map((it: any, idx: number) => ({
                id: `${it.contentId}-${idx}`,
                notificationMsg: this.translate('pages.bookmarks.lists.spaceUnavailable'),
                _placeholder: true,
            }));

        return (
            <>
                <BaseStatusBar therrThemeName={this.props.user.settings?.mobileThemeName} />
                <SafeAreaView edges={[]} style={this.theme.styles.safeAreaView}>
                    <View style={styles.header}>
                        <Text style={[styles.headerTitle, { color: this.theme.colors.textWhite }]}>
                            {activeUserList?.name || this.translate('pages.bookmarks.lists.loading')}
                        </Text>
                        {activeUserList && isOwner && activeUserList.isPublic && (
                            <TouchableOpacity
                                onPress={this.handleShare}
                                style={styles.iconBtn}
                                accessibilityLabel={this.translate('pages.bookmarks.lists.shareList')}
                            >
                                <MaterialIcon name="share" size={22} color="#1C7F8A" />
                            </TouchableOpacity>
                        )}
                        {activeUserList && isOwner && !activeUserList.isDefault && (
                            <TouchableOpacity onPress={this.handleDelete} style={styles.iconBtn}>
                                <MaterialIcon name="delete-outline" size={22} color="#d32f2f" />
                            </TouchableOpacity>
                        )}
                    </View>
                    {activeUserList && isOwner && (
                        <View style={styles.publicRow}>
                            <View style={styles.publicLabelWrap}>
                                <Text style={styles.publicLabel}>
                                    {this.translate('pages.bookmarks.lists.makePublic')}
                                </Text>
                                <Text style={styles.publicHint}>
                                    {activeUserList.isPublic
                                        ? this.translate('pages.bookmarks.lists.publicHintOn')
                                        : this.translate('pages.bookmarks.lists.publicHintOff')}
                                </Text>
                            </View>
                            <Switch
                                value={!!activeUserList.isPublic}
                                disabled={isTogglingPublic}
                                onValueChange={this.handleTogglePublic}
                            />
                        </View>
                    )}
                    <FlatList
                        data={rows}
                        keyExtractor={(item: any, index: number) => `${item.id}-${index}`}
                        contentContainerStyle={{ padding: 12 }}
                        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={this.refresh} />}
                        ListEmptyComponent={() => (
                            !isLoading ? (
                                <View style={styles.empty}>
                                    <Text style={[styles.emptyText, { color: this.theme.colors.textGray }]}>
                                        {this.translate('pages.bookmarks.lists.emptyList')}
                                    </Text>
                                </View>
                            ) : null
                        )}
                        renderItem={({ item }) => (
                            <TouchableOpacity
                                style={styles.card}
                                onPress={() => !item._placeholder && this.goToSpace(item)}
                                disabled={!!item._placeholder}
                            >
                                <View style={styles.cardContent}>
                                    <Text style={styles.cardTitle} numberOfLines={1}>
                                        {item.notificationMsg || item.message || '-'}
                                    </Text>
                                    {!!item.addressReadable && (
                                        <Text style={styles.cardSubtitle} numberOfLines={1}>
                                            {item.addressReadable}
                                        </Text>
                                    )}
                                </View>
                                {!item._placeholder && (
                                    <MaterialIcon name="chevron-right" size={24} color="#aaa" />
                                )}
                            </TouchableOpacity>
                        )}
                    />
                </SafeAreaView>
            </>
        );
    }
}

const styles = StyleSheet.create({
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 14,
        paddingVertical: 10,
    },
    headerTitle: {
        flex: 1,
        fontSize: 18,
        fontWeight: '700',
    },
    iconBtn: {
        padding: 6,
        marginLeft: 4,
    },
    publicRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 14,
        paddingVertical: 8,
        backgroundColor: '#f5f7f8',
    },
    publicLabelWrap: {
        flex: 1,
        paddingRight: 12,
    },
    publicLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: '#222',
    },
    publicHint: {
        marginTop: 2,
        fontSize: 12,
        color: '#666',
    },
    card: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        backgroundColor: '#fff',
        borderRadius: 10,
        marginBottom: 8,
        elevation: 1,
    },
    cardContent: { flex: 1 },
    cardTitle: {
        fontSize: 15,
        fontWeight: '600',
    },
    cardSubtitle: {
        marginTop: 2,
        fontSize: 13,
        color: '#666',
    },
    empty: {
        alignItems: 'center',
        paddingVertical: 48,
    },
    emptyText: {
        color: '#888',
        textAlign: 'center',
    },
});

export default connect(mapStateToProps, mapDispatchToProps)(BookmarkListDetail);
