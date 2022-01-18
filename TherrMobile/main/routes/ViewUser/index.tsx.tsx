import React from 'react';
import { SafeAreaView } from 'react-native';
import 'react-native-gesture-handler';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import {
    UserConnectionsActions,
} from 'therr-react/redux/actions';
import {
    UsersService,
} from 'therr-react/services';
import {
    IUserState,
    IUserConnectionsState,
} from 'therr-react/types';
import UsersActions from '../../redux/actions/UsersActions';
import BaseStatusBar from '../../components/BaseStatusBar';
import { buildStyles } from '../../styles';
import { buildStyles as buildMenuStyles } from '../../styles/navigation/buttonMenu';
import translator from '../../services/translator';
import MainButtonMenu from '../../components/ButtonMenu/MainButtonMenu';
import LottieLoader from '../../components/LottieLoader';
import UserDisplay from './UserDisplay';
import ConfirmModal from '../../components/Modals/ConfirmModal';

interface IViewUserDispatchProps {
    blockUser: Function;
    updateUserConnection: Function
}

interface IStoreProps extends IViewUserDispatchProps {
    user: IUserState;
    userConnections: IUserConnectionsState;
}

// Regular component props
export interface IViewUserProps extends IStoreProps {
    navigation: any;
    route: any;
}

interface IViewUserState {
    confirmModalText: string;
    activeConfirmModal: '' | 'report-user' | 'block-user' | 'remove-connection-request' | 'send-connection-request';
    isLoading: boolean;
    fetchedUserInView: any;
}

const mapStateToProps = (state) => ({
    notifications: state.notifications,
    user: state.user,
});

const mapDispatchToProps = (dispatch: any) => bindActionCreators({
    blockUser: UsersActions.block,
    updateUserConnection: UserConnectionsActions.update,
}, dispatch);

class ViewUser extends React.Component<
    IViewUserProps,
    IViewUserState
> {
    private flatListRef: any;
    private translate: Function;
    private theme = buildStyles();
    private themeMenu = buildMenuStyles();

    constructor(props) {
        super(props);

        this.state = {
            confirmModalText: '',
            activeConfirmModal: '',
            isLoading: true,
            fetchedUserInView: {},
        };

        this.theme = buildStyles(props.user.settings.mobileThemeName);
        this.themeMenu = buildMenuStyles(props.user.settings.mobileThemeName);
        this.translate = (key: string, params: any): string =>
            translator('en-us', key, params);
    }

    componentDidMount() {
        const { navigation } = this.props;

        navigation.setOptions({
            title: this.translate('pages.viewUser.headerTitle'),
        });

        this.fetchUser();
    }

    fetchUser = () => {
        const { route, user } = this.props;
        const { userInView } = route.params;
        const getUserPromise = user.details?.id == userInView.id
            ? Promise.resolve(user.details)
            : UsersService.get(userInView.id).then((response) => response.data);

        getUserPromise.then((userResponse) => {
            this.setState({
                fetchedUserInView: userResponse,
            });
            this.props.navigation.setOptions({
                title: userResponse.userName,
            });
        }).catch((e) => {
            console.log(e);
        }).finally(() => {
            this.setState({
                isLoading: false,
            });
        });
    }
    scrollTop = () => {
        this.flatListRef?.scrollToOffset({ animated: true, offset: 0 });
    }

    handleRefresh = () => {
        this.setState({ isLoading: true });
        this.fetchUser();
    }

    onProfilePicturePress = (selectedUser, isOwnProfile) => {
        console.log('onProfilePicturePress', selectedUser, isOwnProfile);
    }

    onBlockUser = (context, selectedUser) => {
        this.setState({
            confirmModalText: this.translate('modals.confirmModal.blockUser', { userName: selectedUser.userName }),
            activeConfirmModal: 'block-user',
        });
    }

    onConnectionRequest = (context, selectedUser) => {
        if (selectedUser.isNotConnected) {
            this.setState({
                confirmModalText: this.translate('modals.confirmModal.connect', { userName: selectedUser.userName }),
                activeConfirmModal: 'send-connection-request',
            });
        } else {
            this.setState({
                confirmModalText: this.translate('modals.confirmModal.unconnect', { userName: selectedUser.userName }),
                activeConfirmModal: 'remove-connection-request',
            });
        }
    }

    onMessageUser = (context, selectedUser) => {
        // TODO: Update DirectMessage to support messaging non-connected users
        const { navigation } = this.props;
        navigation.navigate('DirectMessage', {
            connectionDetails: {
                id: selectedUser.id,
                userName: selectedUser.userName,
            },
        });
    }

    onReportUser = (context, selectedUser) => {
        this.setState({
            confirmModalText: this.translate('modals.confirmModal.reportUser', { userName: selectedUser.userName }),
            activeConfirmModal: 'report-user',
        });
    }

    onCancelConfirmModal = () => {
        this.setState({
            activeConfirmModal: '',
        });
    }

    onAcceptConfirmModal = () => {
        const { activeConfirmModal, fetchedUserInView } = this.state;
        const { blockUser, navigation, updateUserConnection, user } = this.props;

        if (activeConfirmModal === 'report-user') {
            UsersService.report(fetchedUserInView.id);
            // TODO: Add success toast
        } else if (activeConfirmModal === 'block-user') {
            // TODO: Add success toast
            // TODO: RMOBILE-35: ...
            blockUser(fetchedUserInView.id, user.details.blockedUsers);
            navigation.navigate('Areas');
        } else if (activeConfirmModal === 'send-connection-request') {
            navigation.navigate('CreateConnection');
        } else if (activeConfirmModal === 'remove-connection-request') {
            // TODO: Add success toast
            updateUserConnection({
                connection: {
                    isConnectionBroken: true,
                    otherUserId: fetchedUserInView.id,
                },
                user: user.details,
            });
            navigation.navigate('Areas');
        }

        this.setState({
            activeConfirmModal: '',
        });
    }

    render() {
        const { navigation, user } = this.props;
        const { activeConfirmModal, confirmModalText, fetchedUserInView, isLoading } = this.state;

        return (
            <>
                <BaseStatusBar />
                <SafeAreaView  style={this.theme.styles.safeAreaView}>
                    {
                        isLoading ?
                            <LottieLoader id="therr-black-rolling" /> :
                            <UserDisplay
                                onProfilePicturePress={this.onProfilePicturePress}
                                onBlockUser={this.onBlockUser}
                                onConnectionRequest={this.onConnectionRequest}
                                onMessageUser={this.onMessageUser}
                                onReportUser={this.onReportUser}
                                translate={this.translate}
                                user={user}
                                userInView={fetchedUserInView}
                            />
                    }
                </SafeAreaView>
                <ConfirmModal
                    isVisible={!!activeConfirmModal}
                    onCancel={this.onCancelConfirmModal}
                    onConfirm={this.onAcceptConfirmModal}
                    text={confirmModalText}
                    translate={this.translate}
                    width={activeConfirmModal === 'remove-connection-request' ? '70%' : '60%'}
                    theme={this.theme}
                />
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

export default connect(mapStateToProps, mapDispatchToProps)(ViewUser);
