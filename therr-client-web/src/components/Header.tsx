import * as React from 'react';
import classnames from 'classnames';
import { connect } from 'react-redux';
import { Link } from 'react-router-dom';
import {
    AccessControl,
    SvgButton,
} from 'therr-react/components';
import { IUserState, INotificationsState, INotification } from 'therr-react/types';
import { bindActionCreators } from 'redux';
import translator from '../services/translator';
import { INavMenuContext } from '../types';
import UsersActions from '../redux/actions/UsersActions';

interface IHeaderDispatchProps {
    logout: Function;
}

interface IStoreProps extends IHeaderDispatchProps {
    notifications: INotificationsState;
    user: IUserState;
}

// Regular component props
interface IHeaderProps extends IStoreProps {
  goHome: Function;
  isAuthorized: boolean;
  toggleNavMenu: Function;
  isLandingStylePage?: boolean;
}

interface IHeaderState {
    hasUnreadNotifications: boolean;
}

const mapStateToProps = (state: any) => ({
    notifications: state.notifications,
    user: state.user,
});

const mapDispatchToProps = (dispatch: any) => bindActionCreators({
    logout: UsersActions.logout,
}, dispatch);

export class HeaderComponent extends React.Component<IHeaderProps, IHeaderState> {
    static getDerivedStateFromProps(nextProps: IHeaderProps, nextState: IHeaderState) {
        if (!nextState.hasUnreadNotifications && nextProps.notifications.messages.filter((m: INotification) => m.isUnread).length) {
            return {
                hasUnreadNotifications: true,
            };
        }
        return {};
    }

    private translate: Function;

    constructor(props) {
        super(props);

        this.state = {
            hasUnreadNotifications: false,
        };

        this.translate = (key: string, params: any) => translator('en-us', key, params);
    }

    handleLogout = () => {
        const {
            logout,
            user,
            goHome,
        } = this.props;

        logout(user.details).then(() => {
            goHome();
        });
    };

    render() {
        const { hasUnreadNotifications } = this.state;
        const {
            goHome,
            isAuthorized,
            toggleNavMenu,
            isLandingStylePage,
        } = this.props;
        const headerClassNames = classnames({
            'no-shadow': isLandingStylePage,
        });

        return (
            <header className={headerClassNames}>
                <div id="therr">
                    <SvgButton
                        id="therr_svg_button"
                        iconClassName="therr-icon"
                        name="therr"
                        onClick={() => goHome()}
                        buttonType="primary"
                        aria-label="Therr logo home link"
                    />
                    <SvgButton
                        id="therr_text_svg_button"
                        iconClassName="therr-logo-text"
                        name="therr-text"
                        onClick={() => goHome()}
                        buttonType="primary"
                        aria-label="Therr logo text home link"
                    />
                </div>
                <AccessControl isAuthorized={isAuthorized} publicOnly>
                    <div className="login-link"><Link to="/login">{this.translate('components.header.buttons.login')}</Link></div>
                </AccessControl>
                <AccessControl isAuthorized={isAuthorized}>
                    <SvgButton
                        id="header_account_button"
                        name="account"
                        className={`account-button ${hasUnreadNotifications ? 'has-notifications' : ''}`}
                        onClick={(e) => toggleNavMenu(e, INavMenuContext.HEADER_PROFILE)}
                        buttonType="primary"
                    />
                </AccessControl>
            </header>
        );
    }
}

export default connect(mapStateToProps, mapDispatchToProps)(HeaderComponent);
