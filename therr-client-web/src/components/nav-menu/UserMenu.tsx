import * as React from 'react';
import { connect } from 'react-redux';
import { NavigateFunction } from 'react-router-dom';
import { InlineSvg, SvgButton } from 'therr-react/components';
import { MantineButton } from 'therr-react/components/mantine';
import {
    NotificationActions,
    UserConnectionsActions,
} from 'therr-react/redux/actions';
import { IUserState, INotificationsState, INotification } from 'therr-react/types';
import { UserConnectionTypes } from 'therr-js-utilities/constants';
import { bindActionCreators } from 'redux';
import Notification from './Notification';
import withNavigation from '../../wrappers/withNavigation';
import withTranslation from '../../wrappers/withTranslation';
import shareMomentAnim from '../../assets/lottie/share-a-moment.json';
import discoverAnim from '../../assets/lottie/discover.json';
import thinkerAnim from '../../assets/lottie/thinker-card.json';
import profileCirclingAnim from '../../assets/lottie/profile-circling.json';

// Lazy-load lottie-react only on client (lottie-web crashes on server due to document.createElement)
const Lottie = typeof window !== 'undefined'
    ? React.lazy(() => import('lottie-react'))
    : (() => null) as any;

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
    translate: (key: string, params?: any) => string;
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
    constructor(props) {
        super(props);

        this.state = {
            activeTab: 'notifications',
        };
    }

    handleTabSelect = (e, tabName) => {
        this.setState({
            activeTab: tabName,
        });

        this.props.handleWidthResize(false);
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

        this.toggleNotificationRead(e, notification, updatedUserConnection);

        updateUserConnection({
            connection: {
                otherUserId,
            },
            user: user.details,
        });
    };

    toggleNotificationRead = (event, notification, userConnection?: any) => {
        const { updateNotification, user } = this.props;

        const message = {
            notification: {
                ...notification,
                isUnread: !notification.isUnread,
            },
            userName: user.details.userName,
        };

        if (userConnection) {
            message.notification.isUnread = false;
            message.notification.userConnection = userConnection;
        }

        updateNotification(message);
    };

    markAllNotificationsAsRead = () => {
        const { notifications, updateNotification, user } = this.props;
        const unreadNotifications = notifications.messages.filter((n) => n.isUnread);

        unreadNotifications.forEach((notification) => {
            updateNotification({
                notification: {
                    ...notification,
                    isUnread: false,
                },
                userName: user.details.userName,
            });
        });
    };

    navigate = (destination) => (e) => {
        this.props.toggleNavMenu(e);

        switch (destination) {
            case 'change-password':
                return this.props.navigation.navigate('/users/change-password');
            case 'view-profile':
                return this.props.navigation.navigate('/user/profile');
            case 'edit-profile':
                return this.props.navigation.navigate('/user/edit-profile');
            case 'discovered':
                return this.props.navigation.navigate('/discovered');
            case 'explore':
                return this.props.navigation.navigate('/explore');
            case 'explore-moments':
                return this.props.navigation.navigate('/posts/moments');
            case 'explore-spaces':
                return this.props.navigation.navigate('/locations');
            case 'explore-thoughts':
                return this.props.navigation.navigate('/posts/thoughts');
            case 'explore-people':
                return this.props.navigation.navigate('/users');
            default:
        }
    };

    renderProfileContent = () => (
        <>
            <div className="tab-content-header">
                <h2>{this.props.translate('components.userMenu.h2.profileSettings')}</h2>
            </div>
            <div className="profile-settings-menu">
                <MantineButton
                    id="nav_menu_view_profile"
                    className="menu-item left-icon"
                    leftSection={<InlineSvg name="account" />}
                    text={this.props.translate('components.userMenu.buttons.viewProfile')}
                    onClick={this.navigate('view-profile')}
                    variant="subtle"
                    fullWidth
                />
                <MantineButton
                    id="nav_menu_edit_profile"
                    className="menu-item left-icon"
                    leftSection={<InlineSvg name="settings" />}
                    text={this.props.translate('components.userMenu.buttons.editProfile')}
                    onClick={this.navigate('edit-profile')}
                    variant="subtle"
                    fullWidth
                />
                <MantineButton
                    id="nav_menu_discovered"
                    className="menu-item left-icon"
                    leftSection={<InlineSvg name="bookmark" />}
                    text={this.props.translate('components.userMenu.buttons.discovered')}
                    onClick={this.navigate('discovered')}
                    variant="subtle"
                    fullWidth
                />
            </div>
        </>
    );

    renderNotificationsContent = () => {
        const { notifications } = this.props;
        const hasUnread = notifications.messages.some((n) => n.isUnread);

        return (
            <>
                <div className="tab-content-header notifications-header">
                    <h2>{this.props.translate('components.userMenu.h2.notifications')}</h2>
                    {hasUnread && (
                        <MantineButton
                            id="mark_all_read"
                            className="mark-all-read-button"
                            text={this.props.translate('components.userMenu.buttons.markAllRead')}
                            onClick={this.markAllNotificationsAsRead}
                            variant="subtle"
                            size="xs"
                        />
                    )}
                </div>
                <div className="notifications">
                    {
                        notifications.messages.map((n: INotification) => (
                            <Notification
                                key={n.id}
                                handleSetRead={this.toggleNotificationRead}
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
            <div className="tab-content-header">
                <h2>{this.props.translate('components.userMenu.h2.accountSettings')}</h2>
            </div>
            <div className="account-settings-menu">
                <MantineButton
                    id="nav_menu_change_password"
                    className="menu-item left-icon"
                    leftSection={<InlineSvg name="door" />}
                    text={this.props.translate('components.userMenu.buttons.changePassword')}
                    onClick={this.navigate('change-password')}
                    variant="subtle"
                    fullWidth
                />
            </div>
        </>
    );

    renderLocationContent = () => (
        <>
            <div className="tab-content-header">
                <h2>{this.props.translate('components.userMenu.h2.locationMap')}</h2>
            </div>
            <div className="explore-nav-grid">
                <button
                    type="button"
                    id="nav_menu_explore_moments"
                    className="explore-nav-tile"
                    onClick={this.navigate('explore-moments')}
                >
                    <div className="explore-nav-tile-lottie">
                        <React.Suspense fallback={<div style={{ width: 52, height: 52 }} />}>
                            <Lottie animationData={shareMomentAnim} loop autoplay style={{ width: 52, height: 52 }} />
                        </React.Suspense>
                    </div>
                    <span className="explore-nav-tile-title">{this.props.translate('components.userMenu.buttons.exploreMoments')}</span>
                    <span className="explore-nav-tile-desc">{this.props.translate('components.userMenu.exploreDescriptions.moments')}</span>
                </button>
                <button
                    type="button"
                    id="nav_menu_explore_spaces"
                    className="explore-nav-tile"
                    onClick={this.navigate('explore-spaces')}
                >
                    <div className="explore-nav-tile-lottie">
                        <React.Suspense fallback={<div style={{ width: 52, height: 52 }} />}>
                            <Lottie animationData={discoverAnim} loop autoplay style={{ width: 52, height: 52 }} />
                        </React.Suspense>
                    </div>
                    <span className="explore-nav-tile-title">{this.props.translate('components.userMenu.buttons.exploreSpaces')}</span>
                    <span className="explore-nav-tile-desc">{this.props.translate('components.userMenu.exploreDescriptions.spaces')}</span>
                </button>
                <button
                    type="button"
                    id="nav_menu_explore_thoughts"
                    className="explore-nav-tile"
                    onClick={this.navigate('explore-thoughts')}
                >
                    <div className="explore-nav-tile-lottie">
                        <React.Suspense fallback={<div style={{ width: 52, height: 52 }} />}>
                            <Lottie animationData={thinkerAnim} loop autoplay style={{ width: 52, height: 52 }} />
                        </React.Suspense>
                    </div>
                    <span className="explore-nav-tile-title">{this.props.translate('components.userMenu.buttons.exploreThoughts')}</span>
                    <span className="explore-nav-tile-desc">{this.props.translate('components.userMenu.exploreDescriptions.thoughts')}</span>
                </button>
                <button
                    type="button"
                    id="nav_menu_explore_people"
                    className="explore-nav-tile"
                    onClick={this.navigate('explore-people')}
                >
                    <div className="explore-nav-tile-lottie">
                        <React.Suspense fallback={<div style={{ width: 52, height: 52 }} />}>
                            <Lottie animationData={profileCirclingAnim} loop autoplay style={{ width: 52, height: 52 }} />
                        </React.Suspense>
                    </div>
                    <span className="explore-nav-tile-title">{this.props.translate('components.userMenu.buttons.explorePeople')}</span>
                    <span className="explore-nav-tile-desc">{this.props.translate('components.userMenu.exploreDescriptions.people')}</span>
                </button>
            </div>
            <MantineButton
                id="nav_menu_explore_all"
                className="explore-nav-view-all"
                text={this.props.translate('components.userMenu.buttons.explore')}
                onClick={this.navigate('explore')}
                variant="light"
                fullWidth
            />
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
                            <MantineButton
                                id="nav_menu_logout"
                                className="menu-item left-icon"
                                leftSection={<InlineSvg name="door" />}
                                text={this.props.translate('components.userMenu.buttons.logout')}
                                onClick={handleLogout}
                                variant="subtle"
                                fullWidth
                            />
                        </div>
                }
                <div className="nav-menu-footer">
                    <SvgButton id="nav_menu_footer_close" name="close" className="close-button" onClick={toggleNavMenu} buttonType="primary" />
                </div>
            </>
        );
    }
}

export default withNavigation(withTranslation(connect(mapStateToProps, mapDispatchToProps)(UserMenuComponent)));
