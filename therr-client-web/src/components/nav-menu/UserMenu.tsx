import * as React from 'react';
import { connect } from 'react-redux';
import { NavigateFunction } from 'react-router-dom';
import {
    ButtonPrimary,
    SvgButton,
} from 'therr-react/components';
import {
    NotificationActions,
    UserConnectionsActions,
} from 'therr-react/redux/actions';
import { IUserState, INotificationsState, INotification } from 'therr-react/types';
import { UserConnectionTypes } from 'therr-js-utilities/constants';
import { bindActionCreators } from 'redux';
import Notification from './Notification';
import translator from '../../services/translator';
import withNavigation from '../../wrappers/withNavigation';

interface IUserMenuRouterProps {
    navigation: {
        navigate: NavigateFunction;
    };
}

interface IUserMenuDispatchProps {
    updateNotification: Function;
    updateUserConnection: Function;
}

interface IStoreProps extends IUserMenuDispatchProps {
    notifications: INotificationsState;
    user: IUserState;
}

// Regular component props
interface IUserMenuProps extends IUserMenuRouterProps, IStoreProps {
    handleLogout: any;
    handleWidthResize: Function;
    toggleNavMenu: Function;
}

interface IUserMenuState {
    activeTab: string;
}

const mapStateToProps = (state: any) => ({
    notifications: state.notifications,
    user: state.user,
});

const mapDispatchToProps = (dispatch: any) => bindActionCreators({
    updateNotification: NotificationActions.update,
    updateUserConnection: UserConnectionsActions.update,
}, dispatch);

export class UserMenuComponent extends React.Component<IUserMenuProps, IUserMenuState> {
    private translate: Function;

    constructor(props) {
        super(props);

        this.state = {
            activeTab: 'notifications',
        };

        this.translate = (key: string, params: any) => translator('en-us', key, params);
    }

    handleTabSelect = (e, tabName) => {
        this.setState({
            activeTab: tabName,
        });

        if (tabName === 'location') {
            this.props.handleWidthResize(true);
        } else {
            this.props.handleWidthResize(false);
        }
    };

    handleConnectionRequestAction = (e, notification, isAccepted) => {
        e.stopPropagation();
        const { user, updateUserConnection } = this.props;
        let otherUserId = notification.userConnection.acceptingUserId;

        if (otherUserId === user.details.id) {
            otherUserId = notification.userConnection.requestingUserId;
        }

        const updatedUserConnection = {
            ...notification.userConnection,
            acceptingUserId: user.details.id,
            requestStatus: isAccepted ? UserConnectionTypes.COMPLETE : UserConnectionTypes.DENIED,
        };

        this.markNotificationAsRead(e, notification, updatedUserConnection);

        updateUserConnection({
            connection: {
                otherUserId,
            },
            user: user.details,
        });
    };

    markNotificationAsRead = (event, notification, userConnection?: any) => {
        if (notification.isUnread || userConnection) {
            const { updateNotification, user } = this.props;

            const message = {
                notification: {
                    ...notification,
                    isUnread: false,
                },
                userName: user.details.userName,
            };

            if (userConnection) {
                message.notification.userConnection = userConnection;
            }
            updateNotification(message);
        }
    };

    navigate = (destination) => (e) => {
        this.props.toggleNavMenu(e);

        switch (destination) {
            case 'change-password':
                return this.props.navigation.navigate('/users/change-password');
            case 'view-profile':
                return this.props.navigation.navigate('/user/profile');
            case 'edit-profile':
                return this.props.navigation.navigate('/user/profile');
            default:
        }
    };

    renderProfileContent = () => (
        <>
            <h2>{this.translate('components.userMenu.h2.profileSettings')}</h2>
            <div className="profile-settings-menu">
                <ButtonPrimary
                    id="nav_menu_view_profile"
                    className="menu-item"
                    name={this.translate('components.userMenu.buttons.viewProfile')}
                    text={this.translate('components.userMenu.buttons.viewProfile')} onClick={this.navigate('view-profile')} buttonType="primary" />
                <ButtonPrimary
                    id="nav_menu_edit_profile"
                    className="menu-item"
                    name={this.translate('components.userMenu.buttons.editProfile')}
                    text={this.translate('components.userMenu.buttons.editProfile')} onClick={this.navigate('edit-profile')} buttonType="primary" />
            </div>
        </>
    );

    renderNotificationsContent = () => {
        const { notifications } = this.props;

        return (
            <>
                <h2>{this.translate('components.userMenu.h2.notifications')}</h2>
                <div className="notifications">
                    {
                        notifications.messages.map((n: INotification) => (
                            <Notification
                                key={n.id}
                                handleSetRead={this.markNotificationAsRead}
                                handleConnectionRequestAction={this.handleConnectionRequestAction}
                                notification={n}
                            />
                        ))
                    }
                </div>
            </>
        );
    };

    renderAccountContent = () => (
        <>
            <h2>{this.translate('components.userMenu.h2.accountSettings')}</h2>
            <div className="account-settings-menu">
                <ButtonPrimary
                    id="nav_menu_change_password"
                    className="menu-item"
                    name={this.translate('components.userMenu.buttons.changePassword')}
                    text={this.translate('components.userMenu.buttons.changePassword')} onClick={this.navigate('change-password')} buttonType="primary" />
            </div>
        </>
    );

    renderLocationContent = () => (
        <>
            <h2>{this.translate('components.userMenu.h2.locationMap')}</h2>
        </>
    );

    render() {
        const { activeTab } = this.state;
        const { handleLogout, notifications, toggleNavMenu } = this.props;

        return (
            <>
                <div className="nav-menu-header">
                    <SvgButton
                        id="nav_menu_profile_button"
                        name="account"
                        className={`menu-tab-button ${activeTab === 'profile' ? 'active' : ''}`}
                        iconClassName="tab-icon"
                        onClick={(e) => this.handleTabSelect(e, 'profile')}
                        buttonType="primary"
                    />
                    {
                        notifications.messages.filter((n) => n.isUnread).length ? <SvgButton
                            id="nav_menu_notifications"
                            name="notifications-active"
                            className={`menu-tab-button ${activeTab === 'notifications' ? 'active' : ''} unread-notifications`}
                            iconClassName="tab-icon"
                            onClick={(e) => this.handleTabSelect(e, 'notifications')}
                            buttonType="primary"
                        /> : <SvgButton
                            id="nav_menu_notifications"
                            name="notifications"
                            className={`menu-tab-button ${activeTab === 'notifications' ? 'active' : ''}`}
                            iconClassName="tab-icon"
                            onClick={(e) => this.handleTabSelect(e, 'notifications')}
                            buttonType="primary"
                        />
                    }
                    <SvgButton
                        id="nav_menu_location"
                        name="location"
                        className={`menu-tab-button ${activeTab === 'location' ? 'active' : ''}`}
                        iconClassName="tab-icon"
                        onClick={(e) => this.handleTabSelect(e, 'location')}
                        buttonType="primary"
                    />
                    <SvgButton
                        id="nav_menu_account_settings"
                        name="settings"
                        className={`menu-tab-button ${activeTab === 'account' ? 'active' : ''}`}
                        iconClassName="tab-icon"
                        onClick={(e) => this.handleTabSelect(e, 'account')}
                        buttonType="primary"
                    />
                </div>
                <div className="nav-menu-content">
                    {
                        activeTab === 'profile'
                            && this.renderProfileContent()
                    }
                    {
                        activeTab === 'notifications'
                            && this.renderNotificationsContent()
                    }
                    {
                        activeTab === 'account'
                            && this.renderAccountContent()
                    }
                    {
                        activeTab === 'location'
                            && this.renderLocationContent()
                    }
                </div>
                {
                    activeTab === 'account'
                        && <div className="nav-menu-subfooter">
                            <button type="button" className="primary text-white logout-button" onClick={handleLogout}>Logout</button>
                        </div>
                }
                <div className="nav-menu-footer">
                    <SvgButton id="nav_menu_footer_close" name="close" className="close-button" onClick={toggleNavMenu} buttonType="primary" />
                </div>
            </>
        );
    }
}

export default withNavigation(connect(mapStateToProps, mapDispatchToProps)(UserMenuComponent));
