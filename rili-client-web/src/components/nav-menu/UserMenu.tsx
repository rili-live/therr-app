import * as React from 'react';
import { connect } from 'react-redux';
import SvgButton from 'rili-public-library/react-components/SvgButton.js';
import { IUserState } from 'types/user';
import SocketActions from 'actions/Socket';
import { bindActionCreators } from 'redux';

interface IUserMenuDispatchProps {
    logout: Function;
}

interface IStoreProps extends IUserMenuDispatchProps {
    user: IUserState;
}

// Regular component props
interface IUserMenuProps extends IStoreProps {
    handleLogout: any;
    toggleNavMenu: Function;
}

interface IUserMenuState {
    activeTab: string;
}

const mapStateToProps = (state: any) => ({
    user: state.user,
});

const mapDispatchToProps = (dispatch: any) => bindActionCreators({
    logout: SocketActions.logout,
}, dispatch);

export class UserMenuComponent extends React.Component<IUserMenuProps, IUserMenuState> {
    constructor(props) {
        super(props);

        this.state = {
            activeTab: 'profile',
        };
    }

    handleTabSelect = (e, tabName) => {
        this.setState({
            activeTab: tabName,
        });
    }

    renderProfileContent = () => (
        <>
            <h2>Profile Settings</h2>
        </>
    )

    renderNotificationsContent = () => (
        <>
            <h2>Notification</h2>
        </>
    )

    renderAccountContent = () => (
        <>
            <h2>Account Settings</h2>
        </>
    )

    render() {
        const { activeTab } = this.state;
        const { toggleNavMenu, handleLogout } = this.props;

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
                    <SvgButton
                        id="nav_menu_notifications"
                        name="notifications"
                        className={`menu-tab-button ${activeTab === 'notifications' ? 'active' : ''}`}
                        iconClassName="tab-icon"
                        onClick={(e) => this.handleTabSelect(e, 'notifications')}
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

export default connect(mapStateToProps, mapDispatchToProps)(UserMenuComponent);
