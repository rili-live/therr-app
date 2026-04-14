import React from 'react';
import {
    FlatList,
    RefreshControl,
    SafeAreaView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import { ContentActions } from 'therr-react/redux/actions';
import MaterialIcon from 'react-native-vector-icons/MaterialIcons';
import BaseStatusBar from '../../components/BaseStatusBar';
import translator from '../../services/translator';
import { buildStyles } from '../../styles';

interface IMyListsDispatchProps {
    fetchUserLists: Function;
}

interface IStoreProps extends IMyListsDispatchProps {
    content: any;
    user: any;
}

interface IMyListsProps extends IStoreProps {
    navigation: any;
}

interface IMyListsState {
    isLoading: boolean;
}

const mapStateToProps = (state: any) => ({
    content: state.content,
    user: state.user,
});

const mapDispatchToProps = (dispatch: any) =>
    bindActionCreators(
        {
            fetchUserLists: ContentActions.fetchUserLists,
        },
        dispatch,
    );

class MyLists extends React.Component<IMyListsProps, IMyListsState> {
    private translate: Function;
    private theme = buildStyles();

    constructor(props: IMyListsProps) {
        super(props);

        this.state = { isLoading: true };

        this.theme = buildStyles(props.user.settings?.mobileThemeName);
        this.translate = (key: string, params?: any) =>
            translator(props.user.settings?.locale || 'en-us', key, params);
    }

    componentDidMount() {
        const { navigation } = this.props;
        navigation.setOptions({
            title: this.translate('pages.bookmarks.lists.title'),
        });
        this.refresh();
    }

    refresh = () => {
        this.setState({ isLoading: true });
        return this.props.fetchUserLists(true).finally(() => this.setState({ isLoading: false }));
    };

    goToList = (list: any) => {
        this.props.navigation.navigate('BookmarkListDetail', { listId: list.id });
    };

    render() {
        const userLists: any[] = this.props.content?.userLists || [];
        const { isLoading } = this.state;

        return (
            <>
                <BaseStatusBar therrThemeName={this.props.user.settings?.mobileThemeName} />
                <SafeAreaView style={this.theme.styles.safeAreaView}>
                    <FlatList
                        data={userLists}
                        keyExtractor={(item) => item.id}
                        contentContainerStyle={{ padding: 12 }}
                        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={this.refresh} />}
                        ListEmptyComponent={() => (
                            !isLoading ? (
                                <View style={styles.empty}>
                                    <Text style={styles.emptyText}>
                                        {this.translate('pages.bookmarks.lists.emptyState')}
                                    </Text>
                                </View>
                            ) : null
                        )}
                        renderItem={({ item }) => (
                            <TouchableOpacity style={styles.card} onPress={() => this.goToList(item)}>
                                <View style={[styles.swatch, { backgroundColor: item.colorHex || '#e0f2f1' }]}>
                                    <MaterialIcon
                                        name={item.iconName || (item.isDefault ? 'bookmark' : 'list')}
                                        size={28}
                                        color="#555"
                                    />
                                </View>
                                <View style={{ flex: 1, marginLeft: 12 }}>
                                    <Text style={styles.name}>{item.name}</Text>
                                    <Text style={styles.meta}>
                                        {this.translate('pages.bookmarks.lists.itemCount', { count: item.itemCount ?? 0 })}
                                        {item.isDefault ? ` · ${this.translate('pages.bookmarks.lists.default')}` : ''}
                                    </Text>
                                </View>
                                <MaterialIcon name="chevron-right" size={24} color="#aaa" />
                            </TouchableOpacity>
                        )}
                    />
                </SafeAreaView>
            </>
        );
    }
}

const styles = StyleSheet.create({
    card: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 12,
        marginBottom: 10,
        elevation: 1,
        shadowColor: '#000',
        shadowOpacity: 0.04,
        shadowRadius: 4,
    },
    swatch: {
        width: 56,
        height: 56,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    name: {
        fontSize: 16,
        fontWeight: '600',
    },
    meta: {
        marginTop: 2,
        fontSize: 13,
        color: '#777',
    },
    empty: {
        alignItems: 'center',
        paddingVertical: 48,
    },
    emptyText: {
        fontSize: 14,
        color: '#888',
        textAlign: 'center',
    },
});

export default connect(mapStateToProps, mapDispatchToProps)(MyLists);
