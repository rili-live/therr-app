import * as React from 'react';
import classnames from 'classnames';
import { connect } from 'react-redux';
import { Link } from 'react-router-dom';
import { ActionIcon } from '@mantine/core';
import {
    AccessControl,
    SvgButton,
} from 'therr-react/components';
import { IUserState, INotificationsState, INotification } from 'therr-react/types';
import { SocketClientActionTypes } from 'therr-js-utilities/constants';
import { bindActionCreators } from 'redux';
import { INavMenuContext } from '../types';
import withTranslation from '../wrappers/withTranslation';
import UsersActions from '../redux/actions/UsersActions';
import ColorSchemeToggle from './ColorSchemeToggle';

const supportedLocales = ['en-us', 'es'] as const;
const localeLabels: Record<string, string> = { 'en-us': 'EN', es: 'ES' };

const globeIcon = (
    <svg
        xmlns="http://www.w3.org/2000/svg"
        width={18}
        height={18}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
    >
        <circle cx="12" cy="12" r="10" />
        <line x1="2" y1="12" x2="22" y2="12" />
        <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10A15.3 15.3 0 0 1 12 2z" />
    </svg>
);

interface IHeaderDispatchProps {
    logout: Function;
    updateUser: Function;
}

interface IStoreProps extends IHeaderDispatchProps {
    notifications: INotificationsState;
    user: IUserState;
}

// Regular component props
interface IHeaderProps extends IStoreProps {
  goHome: Function;
  goTo: Function;
  isAuthorized: boolean;
  toggleNavMenu: Function;
  isLandingStylePage?: boolean;
  translate: (key: string, params?: any) => string;
  locale: string;
  dispatch: Function;
}

interface IHeaderState {
    hasUnreadNotifications: boolean;
}

const mapStateToProps = (state: any) => ({
    notifications: state.notifications,
    user: state.user,
});

const mapDispatchToProps = (dispatch: any) => ({
    ...bindActionCreators({
        logout: UsersActions.logout,
        updateUser: UsersActions.update,
    }, dispatch),
    dispatch,
});

export class HeaderComponent extends React.Component<IHeaderProps, IHeaderState> {
    static getDerivedStateFromProps(nextProps: IHeaderProps) {
        const hasUnread = nextProps.notifications.messages.filter((m: INotification) => m.isUnread).length > 0;
        return {
            hasUnreadNotifications: hasUnread,
        };
    }

    constructor(props) {
        super(props);

        this.state = {
            hasUnreadNotifications: false,
        };
    }

    handleLocaleChange = () => {
        const {
            dispatch, locale, user, updateUser,
        } = this.props;
        const currentIndex = supportedLocales.indexOf(locale as any);
        const newLocale = supportedLocales[(currentIndex + 1) % supportedLocales.length];

        // Update Redux state immediately
        dispatch({
            type: SocketClientActionTypes.UPDATE_USER,
            data: {
                details: {},
                settings: { locale: newLocale, settingsLocale: newLocale },
            },
        });

        // Persist to both localStorage and sessionStorage so the update
        // action response handler doesn't overwrite with stale values
        try {
            [localStorage, sessionStorage].forEach((storage) => {
                const storedSettings = JSON.parse(storage.getItem('therrUserSettings') || '{}');
                storedSettings.locale = newLocale;
                storedSettings.settingsLocale = newLocale;
                storage.setItem('therrUserSettings', JSON.stringify(storedSettings));
            });
        } catch (err) {
            // Ignore storage errors
        }

        // Set cookie for SSR locale detection
        document.cookie = `therr-locale=${newLocale};path=/;max-age=31536000;SameSite=Lax`;

        // Update HTML lang attribute for accessibility and client-side SEO
        const htmlLangMap: Record<string, string> = { 'en-us': 'en-US', es: 'es-MX' };
        document.documentElement.lang = htmlLangMap[newLocale] || 'en-US';

        // Persist to backend for authenticated users
        if (user?.isAuthenticated && user?.details?.id) {
            updateUser(user.details.id, { settingsLocale: newLocale });
        }
    };

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
            goTo,
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
                <div className="header-right">
                    <ActionIcon
                        variant="subtle"
                        color="gray"
                        className="locale-switcher"
                        onClick={this.handleLocaleChange}
                        title="Switch language"
                        aria-label="Switch language"
                        style={{ color: 'inherit' }}
                    >
                        <span className="locale-label">
                            {localeLabels[this.props.locale] || 'EN'}
                        </span>
                        {globeIcon}
                    </ActionIcon>
                    <ColorSchemeToggle />
                    <AccessControl isAuthorized={isAuthorized} publicOnly>
                        <div className="login-link">
                            <SvgButton
                                id="header_login_icon"
                                name="account"
                                onClick={() => goTo('/login')}
                                buttonType="primary"
                                aria-label="Sign in to Therr web app"
                            />
                            <Link to="/login">{this.props.translate('components.header.buttons.login')}</Link>
                        </div>
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
                </div>
            </header>
        );
    }
}

export default withTranslation(connect(mapStateToProps, mapDispatchToProps)(HeaderComponent));
