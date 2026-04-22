import React from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
    Alert,
    FlatList,
    RefreshControl,
    StyleSheet,
    Text,
    TouchableOpacity,
    View} from 'react-native';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import { ContentActions } from 'therr-react/redux/actions';
import MaterialIcon from 'react-native-vector-icons/MaterialIcons';
import BaseStatusBar from '../../components/BaseStatusBar';
import translator from '../../utilities/translator';
import { buildStyles } from '../../styles';
import { navToViewContent } from '../../utilities/postViewHelpers';

interface IListDetailDispatchProps {
    fetchUserList: Function;
    deleteUserList: Function;
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
        },
        dispatch,
    );

class BookmarkListDetail extends React.Component<IListDetailProps, IListDetailState> {
    private translate: Function;
    private theme = buildStyles();

    constructor(props: IListDetailProps) {
        super(props);

        this.state = { isLoading: true };

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
        const { content } = this.props;
        const activeUserList = content?.activeUserList;
        const { isLoading } = this.state;
        const spaces = activeUserList?.spaces || [];
        const items = activeUserList?.items || [];
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
                        {activeUserList && !activeUserList.isDefault && (
                            <TouchableOpacity onPress={this.handleDelete} style={styles.deleteBtn}>
                                <MaterialIcon name="delete-outline" size={22} color="#d32f2f" />
                            </TouchableOpacity>
                        )}
                    </View>
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
    deleteBtn: {
        padding: 6,
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
