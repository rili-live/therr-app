import React from 'react';
import { Dimensions, FlatList, SafeAreaView, Text, View } from 'react-native';
import 'react-native-gesture-handler';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import { UserConnectionsActions } from 'therr-react/redux/actions';
import { IUserState, IUserConnectionsState } from 'therr-react/types';
import { TabBar, TabView } from 'react-native-tab-view';
import { buildStyles } from '../../styles';
import { buildStyles as buildButtonsStyles } from '../../styles/buttons';
import { buildStyles as buildConfirmModalStyles } from '../../styles/modal/confirmModal';
import { buildStyles as buildMenuStyles } from '../../styles/navigation/buttonMenu';
import translator from '../../services/translator';
import BaseStatusBar from '../../components/BaseStatusBar';
import MainButtonMenu from '../../components/ButtonMenu/MainButtonMenu';
import ConnectionItem from './components/ConnectionItem';
import CreateConnectionButton from '../../components/CreateConnectionButton';
import { RefreshControl } from 'react-native-gesture-handler';
import LazyPlaceholder from './components/LazyPlaceholder';
import CreateConnection from './components/CreateConnection';
import ConfirmModal from '../../components/Modals/ConfirmModal';

const { width: viewportWidth } = Dimensions.get('window');

interface IContactsDispatchProps {
    logout: Function;
    searchUserConnections: Function;
}

interface IStoreProps extends IContactsDispatchProps {
    user: IUserState;
    userConnections: IUserConnectionsState;
}

// Regular component props
export interface IContactsProps extends IStoreProps {
    navigation: any;
    route: any;
}

interface IContactsState {
    isNameConfirmModalVisible: boolean;
    isRefreshing: boolean;
    activeTabIndex: number;
    tabRoutes: { key: string; title: string }[]
}

const mapStateToProps = (state) => ({
    user: state.user,
    userConnections: state.userConnections,
});

const mapDispatchToProps = (dispatch: any) =>
    bindActionCreators(
        {
            searchUserConnections: UserConnectionsActions.search,
        },
        dispatch
    );

class Contacts extends React.Component<IContactsProps, IContactsState> {
    private translate: Function;
    private theme = buildStyles();
    private themeButtons = buildButtonsStyles();
    private themeConfirmModal = buildConfirmModalStyles();
    private themeMenu = buildMenuStyles();
    private unsubscribeFocusListener;

    constructor(props) {
        super(props);

        this.translate = (key: string, params: any) =>
            translator('en-us', key, params);

        const { route } = props;
        const activeTabIndex = route.params?.activeTab === 'invite' ? 1 : 0;

        this.state = {
            activeTabIndex,
            isNameConfirmModalVisible: false,
            isRefreshing: false,
            tabRoutes: [
                { key: 'connections', title: this.translate('menus.headerTabs.connections') },
                { key: 'invite', title: this.translate('menus.headerTabs.invite') },
            ],
        };

        this.theme = buildStyles(props.user.settings?.mobileThemeName);
        this.themeButtons = buildButtonsStyles(props.user.settings?.mobileThemeName);
        this.themeConfirmModal = buildConfirmModalStyles(props.user.settings?.mobileThemeName);
        this.themeMenu = buildMenuStyles(props.user.settings?.mobileThemeName);
    }

    componentDidMount() {
        const { navigation, userConnections } = this.props;

        navigation.setOptions({
            title: this.translate('pages.contacts.headerTitle'),
        });

        if (!userConnections.connections.length) {
            this.handleRefresh();
        }

        this.unsubscribeFocusListener = navigation.addListener('focus', () => {
            const { route } = this.props;
            const activeTabIndex = route.params?.activeTab === 'invite' ? 1 : 0;

            this.setState({
                activeTabIndex,
            });
        });
    }

    componentWillUnmount() {
        if (this.unsubscribeFocusListener) {
            this.unsubscribeFocusListener();
        }
    }

    getConnectionDetails = (connection) => {
        const { user } = this.props;

        // Active connection format
        if (!connection.users) {
            return connection;
        }

        // User <-> User connection format
        return (
            connection.users.find(
                (u) => user.details && u.id !== user.details.id
            ) || {}
        );
    };

    getConnectionSubtitle = (connectionDetails) => {
        if (!connectionDetails?.firstName && !connectionDetails?.lastName) {
            return this.translate('pages.userProfile.anonymous');
        }
        return `${connectionDetails.firstName || ''} ${
            connectionDetails.lastName || ''
        }`;
    };

    goToViewUser = (userId) => {
        const { navigation } = this.props;

        navigation.navigate('ViewUser', {
            userInView: {
                id: userId,
            },
        });
    }

    onConnectionPress = (connectionDetails) => {
        const { navigation } = this.props;

        navigation.navigate('DirectMessage', {
            connectionDetails,
        });
    };

    onTabSelect = (index: number) => {
        this.setState({
            activeTabIndex: index,
        });
    }

    handleRefresh = () => {
        const { user } = this.props;

        this.setState({
            isRefreshing: true,
        });

        this.props
            .searchUserConnections(
                {
                    filterBy: 'acceptingUserId',
                    query: user.details && user.details.id,
                    itemsPerPage: 50,
                    pageNumber: 1,
                    orderBy: 'interactionCount',
                    order: 'desc',
                    shouldCheckReverse: true,
                },
                user.details && user.details.id
            )
            .catch(() => {})
            .finally(() => {
                this.setState({
                    isRefreshing: false,
                });
            });
    }

    handleNameConfirm = () => {
        const { navigation } = this.props;

        this.toggleNameConfirmModal();
        navigation.navigate('Settings');
    }

    toggleNameConfirmModal = () => {
        this.setState({
            isNameConfirmModalVisible: !this.state.isNameConfirmModalVisible,
        });
    }

    navToInvite = () => {
        this.setState({
            activeTabIndex: 1,
        });
    }

    sortConnections = () => {
        const { userConnections } = this.props;
        const activeConnections = [...(userConnections?.activeConnections || [])].map(a => ({ ...a, isActive: true }));
        const inactiveConnections = userConnections?.connections
            ?.filter(c => !activeConnections.find(a => a.id === c.requestingUserId || a.id === c.acceptingUserId)) || [];

        return activeConnections.concat(inactiveConnections);
    }

    renderTabBar = props => {
        return (
            <TabBar
                {...props}
                indicatorStyle={this.themeMenu.styles.tabFocusedIndicator}
                style={this.themeMenu.styles.tabBar}
                renderLabel={this.renderTabLabel}
            />
        );
    };

    renderTabLabel = ({ route, focused }) => {
        return (
            <Text style={focused ? this.themeMenu.styles.tabTextFocused : this.themeMenu.styles.tabText}>
                {route.title}
            </Text>
        );
    }

    renderSceneMap = ({ route }) => {
        const { isRefreshing } = this.state;

        switch (route.key) {
            case 'connections':
                const connections = this.sortConnections();

                return (
                    <FlatList
                        data={connections}
                        keyExtractor={(item) => String(item.id)}
                        renderItem={({ item: connection }) => (
                            <ConnectionItem
                                key={connection.id}
                                connectionDetails={this.getConnectionDetails(connection)}
                                getConnectionSubtitle={this.getConnectionSubtitle}
                                goToViewUser={this.goToViewUser}
                                isActive={connection.isActive}
                                onConnectionPress={this.onConnectionPress}
                                theme={this.theme}
                                translate={this.translate}
                            />
                        )}
                        ListEmptyComponent={() => (
                            <View style={this.theme.styles.sectionContainer}>
                                <Text style={this.theme.styles.sectionDescription}>
                                    {this.translate(
                                        'components.contactsSearch.noContactsFound'
                                    )}
                                </Text>
                            </View>
                        )}
                        stickyHeaderIndices={[]}
                        refreshControl={<RefreshControl
                            refreshing={isRefreshing}
                            onRefresh={this.handleRefresh}
                        />}
                        // onContentSizeChange={() => connections.length && flatListRef.scrollToOffset({ animated: true, offset: 0 })}
                    />
                );
            case 'invite':
                const { navigation } = this.props;

                return (
                    <CreateConnection
                        navigation={navigation}
                        toggleNameConfirmModal={this.toggleNameConfirmModal}
                    />
                );
        }
    }

    render() {
        const { activeTabIndex, isNameConfirmModalVisible, tabRoutes } = this.state;
        const { navigation, user } = this.props;

        return (
            <>
                <BaseStatusBar therrThemeName={this.props.user.settings?.mobileThemeName}/>
                <SafeAreaView style={this.theme.styles.safeAreaView}>
                    <TabView
                        lazy
                        lazyPreloadDistance={1}
                        navigationState={{
                            index: activeTabIndex,
                            routes: tabRoutes,
                        }}
                        renderTabBar={this.renderTabBar}
                        renderScene={this.renderSceneMap}
                        renderLazyPlaceholder={() => (
                            <View style={this.theme.styles.sectionContainer}>
                                <LazyPlaceholder />
                                <LazyPlaceholder />
                                <LazyPlaceholder />
                                <LazyPlaceholder />
                                <LazyPlaceholder />
                                <LazyPlaceholder />
                                <LazyPlaceholder />
                                <LazyPlaceholder />
                            </View>
                        )}
                        onIndexChange={this.onTabSelect}
                        initialLayout={{ width: viewportWidth }}
                        // style={styles.container}
                    />
                </SafeAreaView>
                <ConfirmModal
                    isVisible={isNameConfirmModalVisible}
                    onCancel={this.toggleNameConfirmModal}
                    onConfirm={this.handleNameConfirm}
                    text={this.translate('forms.createConnection.modal.nameConfirm')}
                    textCancel={this.translate('forms.createConnection.modal.noThanks')}
                    translate={this.translate}
                    theme={this.theme}
                    themeModal={this.themeConfirmModal}
                    themeButtons={this.themeButtons}
                />
                <CreateConnectionButton onPress={this.navToInvite} themeButtons={this.themeButtons} translate={this.translate} />
                <MainButtonMenu
                    navigation={navigation}
                    onActionButtonPress={this.handleRefresh}
                    translate={this.translate}
                    user={user}
                    themeMenu={this.themeMenu}
                />
            </>
        );
    }
}

export default connect(mapStateToProps, mapDispatchToProps)(Contacts);
