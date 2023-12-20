import React from 'react';
import { SafeAreaView } from 'react-native';
import 'react-native-gesture-handler';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import { UserConnectionsActions } from 'therr-react/redux/actions';
import { IUserState, IUserConnectionsState } from 'therr-react/types';
import { buildStyles } from '../../styles';
import { buildStyles as buildButtonsStyles } from '../../styles/buttons';
import { buildStyles as buildConfirmModalStyles } from '../../styles/modal/confirmModal';
import { buildStyles as buildMenuStyles } from '../../styles/navigation/buttonMenu';
import translator from '../../services/translator';
import BaseStatusBar from '../../components/BaseStatusBar';
import MainButtonMenu from '../../components/ButtonMenu/MainButtonMenu';
import CreateConnection from './components/CreateConnection';
import ConfirmModal from '../../components/Modals/ConfirmModal';
import UsersActions from '../../redux/actions/UsersActions';

const DEFAULT_PAGE_SIZE = 50;

interface IContactsDispatchProps {
    createUserConnection: Function;
    logout: Function;
    searchUserConnections: Function;
    searchUsers: Function;
    searchUpdateUser: Function;
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
    isRefreshingUserSearch: boolean;
}

const mapStateToProps = (state) => ({
    user: state.user,
    userConnections: state.userConnections,
});

const mapDispatchToProps = (dispatch: any) =>
    bindActionCreators(
        {
            createUserConnection: UserConnectionsActions.create,
            searchUserConnections: UserConnectionsActions.search,
            searchUsers: UsersActions.search,
            searchUpdateUser: UsersActions.searchUpdateUser,
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
    private peopleListRef;
    private connectionsListRef;

    constructor(props) {
        super(props);

        this.translate = (key: string, params: any) =>
            translator('en-us', key, params);

        this.state = {
            isNameConfirmModalVisible: false,
            isRefreshing: false,
            isRefreshingUserSearch: false,
        };

        this.theme = buildStyles(props.user.settings?.mobileThemeName);
        this.themeButtons = buildButtonsStyles(props.user.settings?.mobileThemeName);
        this.themeConfirmModal = buildConfirmModalStyles(props.user.settings?.mobileThemeName);
        this.themeMenu = buildMenuStyles(props.user.settings?.mobileThemeName);
    }

    componentDidMount() {
        const { navigation, user, userConnections } = this.props;

        navigation.setOptions({
            title: this.translate('pages.invite.headerTitle'),
        });

        if ((userConnections.connections.length || 0) < DEFAULT_PAGE_SIZE) {
            this.handleRefresh();
        }

        if ((Object.keys(user.users || {})?.length || 0) < DEFAULT_PAGE_SIZE) {
            this.handleRefreshUsersSearch();
        }
    }

    componentWillUnmount() {
        if (this.unsubscribeFocusListener) {
            this.unsubscribeFocusListener();
        }
    }

    getConnectionOrUserDetails = (userOrConnection) => {
        const { user } = this.props;

        // Active connection format
        if (!userOrConnection.users) {
            return userOrConnection;
        }

        // User <-> User connection format
        return (
            userOrConnection.users.find(
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
    };

    onConnectionPress = (connectionDetails) => {
        const { navigation } = this.props;

        navigation.navigate('DirectMessage', {
            connectionDetails,
        });
    };

    trySearchMoreUsers = () => {

    };

    handleRefreshUsersSearch = () => {
        this.setState({
            isRefreshingUserSearch: true,
        });

        this.props
            .searchUsers(
                {
                    query: '',
                    limit: DEFAULT_PAGE_SIZE,
                    offset: 0,
                    withMedia: true,
                },
            )
            .catch(() => {})
            .finally(() => {
                this.setState({
                    isRefreshingUserSearch: false,
                });
            });
    };

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
                    itemsPerPage: DEFAULT_PAGE_SIZE,
                    pageNumber: 1,
                    orderBy: 'interactionCount',
                    order: 'desc',
                    shouldCheckReverse: true,
                    withMedia: true,
                },
                user.details && user.details.id
            )
            .catch(() => {})
            .finally(() => {
                this.setState({
                    isRefreshing: false,
                });
            });
    };

    handleNameConfirm = () => {
        const { navigation } = this.props;

        this.toggleNameConfirmModal();
        navigation.navigate('Settings');
    };

    onSendConnectRequest = (acceptingUser: any) => {
        const { createUserConnection, user, searchUpdateUser } = this.props;
        // TODO: Send connection request
        createUserConnection({
            requestingUserId: user.details.id,
            requestingUserFirstName: user.details.firstName,
            requestingUserLastName: user.details.lastName,
            requestingUserEmail: user.details.email,
            acceptingUserId: acceptingUser?.id,
            acceptingUserPhoneNumber: acceptingUser?.phoneNumber,
            acceptingUserEmail: acceptingUser?.email,
        }, {
            userName: user?.details?.userName,
        }).then(() => {
            searchUpdateUser(acceptingUser.id, {
                isConnected: true,
            });
        });
    };

    toggleNameConfirmModal = () => {
        this.setState({
            isNameConfirmModalVisible: !this.state.isNameConfirmModalVisible,
        });
    };

    scrollTop = () => {
        const { userConnections, user } = this.props;

        if (userConnections.connections?.length) {
            this.connectionsListRef?.scrollToOffset({ animated: true, offset: 0 });
        }
        if (Object.keys(user.users || {}).length) {
            this.peopleListRef?.scrollToOffset({ animated: true, offset: 0 });
        }
    };

    sortConnections = () => {
        const { userConnections } = this.props;
        const activeConnections = [...(userConnections?.activeConnections || [])].map(a => ({ ...a, isActive: true }));
        const inactiveConnections = userConnections?.connections
            ?.filter(c => !activeConnections.find(a => a.id === c.requestingUserId || a.id === c.acceptingUserId)) || [];

        return activeConnections.concat(inactiveConnections);
    };

    render() {
        const { isNameConfirmModalVisible } = this.state;
        const { navigation, user } = this.props;
        const shouldLaunchContacts = this.props.route?.params?.shouldLaunchContacts;

        return (
            <>
                <BaseStatusBar therrThemeName={this.props.user.settings?.mobileThemeName}/>
                <SafeAreaView style={this.theme.styles.safeAreaView}>
                    <CreateConnection
                        navigation={navigation}
                        shouldLaunchContacts={shouldLaunchContacts}
                        toggleNameConfirmModal={this.toggleNameConfirmModal}
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
                <MainButtonMenu
                    activeRoute="Invite"
                    navigation={navigation}
                    onActionButtonPress={this.scrollTop}
                    translate={this.translate}
                    user={user}
                    themeMenu={this.themeMenu}
                />
            </>
        );
    }
}

export default connect(mapStateToProps, mapDispatchToProps)(Contacts);
