import * as React from 'react';
import classnames from 'classnames';
import { connect } from 'react-redux';
import { Link } from 'react-router-dom';
import {
    ActionIcon, Button, Group, Menu, Modal, Text,
} from '@mantine/core';
import {
    AccessControl,
    SvgButton,
} from 'therr-react/components';
import { IUserState, INotificationsState, INotification } from 'therr-react/types';
import { bindActionCreators } from 'redux';
import { INavMenuContext } from '../types';
import withTranslation from '../wrappers/withTranslation';
import UsersActions from '../redux/actions/UsersActions';
import ColorSchemeToggle from './ColorSchemeToggle';

const localeLabels: Record<string, string> = { 'en-us': 'EN', es: 'ES', 'fr-ca': 'FR' };

const localeOptions = [
    { code: 'en-us', label: 'EN', name: 'English' },
    { code: 'es', label: 'ES', name: 'Español' },
    { code: 'fr-ca', label: 'FR', name: 'Français' },
];

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
    isOnline: boolean;
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
}

interface IHeaderState {
    hasUnreadNotifications: boolean;
    isOfflineModalOpen: boolean;
}

const mapStateToProps = (state: any) => ({
    notifications: state.notifications,
    user: state.user,
    // network.isConnected may be undefined on first paint; treat anything not
    // explicitly false as online so we don't flash the offline UI on load.
    isOnline: state.network?.isConnected !== false,
});

const mapDispatchToProps = (dispatch: any) => bindActionCreators({
    logout: UsersActions.logout,
    updateUser: UsersActions.update,
}, dispatch);

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
            isOfflineModalOpen: false,
        };
    }

    componentDidUpdate(prevProps: IHeaderProps) {
        if (prevProps.isOnline === false && this.props.isOnline) {
            this.setState({ isOfflineModalOpen: false });
        }
    }

    handleLogoClick = () => {
        if (!this.props.isOnline) {
            this.setState({ isOfflineModalOpen: true });
            return;
        }
        this.props.goHome();
    };

    handleRefreshConnection = () => {
        if (typeof window !== 'undefined') {
            window.location.reload();
        }
    };

    closeOfflineModal = () => {
        this.setState({ isOfflineModalOpen: false });
    };

    handleLocaleChange = (newLocale: string) => {
        const {
            user, updateUser,
        } = this.props;
        const currentPath = window.location.pathname;

        // Set cookie for API calls and SSR
        document.cookie = `therr-locale=${newLocale};path=/;max-age=31536000;SameSite=Lax`;

        // Persist to storage
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

        // Persist to backend for authenticated users
        if (user?.isAuthenticated && user?.details?.id) {
            updateUser(user.details.id, { settingsLocale: newLocale });
        }

        // Strip any existing locale prefix from the path
        const strippedPath = currentPath.replace(/^\/(es|fr)(\/|$)/, '/') || '/';

        // Build new path with locale prefix (English has no prefix)
        const localePrefixMap: Record<string, string> = { es: '/es', 'fr-ca': '/fr' };
        const prefix = localePrefixMap[newLocale] || '';
        let newPath = strippedPath;
        if (prefix) {
            newPath = strippedPath === '/' ? prefix : `${prefix}${strippedPath}`;
        }

        window.location.href = newPath + window.location.search;
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
        const { hasUnreadNotifications, isOfflineModalOpen } = this.state;
        const {
            goTo,
            isAuthorized,
            toggleNavMenu,
            isLandingStylePage,
            isOnline,
            translate,
        } = this.props;
        const headerClassNames = classnames({
            'no-shadow': isLandingStylePage,
        });
        const logoAriaLabel = isOnline
            ? 'Therr logo home link'
            : translate('components.offlineIndicator.logoAriaOffline');

        return (
            <header className={headerClassNames}>
                <div id="therr">
                    <SvgButton
                        id="therr_svg_button"
                        iconClassName="therr-icon"
                        name="therr"
                        onClick={this.handleLogoClick}
                        buttonType="primary"
                        aria-label={logoAriaLabel}
                    />
                    {!isOnline && (
                        <span
                            className="offline-badge"
                            role="img"
                            aria-label={translate('components.offlineIndicator.badgeAria')}
                            title={translate('components.offlineIndicator.badgeAria')}
                        >
                            !
                        </span>
                    )}
                    <SvgButton
                        id="therr_text_svg_button"
                        iconClassName="therr-logo-text"
                        name="therr-text"
                        onClick={this.handleLogoClick}
                        buttonType="primary"
                        aria-label={logoAriaLabel}
                    />
                </div>
                <div className="header-right">
                    <Menu shadow="md" width={160} position="bottom-end">
                        <Menu.Target>
                            <ActionIcon
                                variant="subtle"
                                color="gray"
                                className="locale-switcher"
                                title="Switch language"
                                aria-label="Switch language"
                                style={{ color: 'inherit' }}
                            >
                                <span className="locale-label">
                                    {localeLabels[this.props.locale] || 'EN'}
                                </span>
                                {globeIcon}
                            </ActionIcon>
                        </Menu.Target>
                        <Menu.Dropdown className="locale-menu">
                            {localeOptions.map((opt) => (
                                <Menu.Item
                                    key={opt.code}
                                    onClick={() => this.handleLocaleChange(opt.code)}
                                >
                                    {opt.label} - {opt.name}
                                </Menu.Item>
                            ))}
                        </Menu.Dropdown>
                    </Menu>
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
                <Modal
                    opened={isOfflineModalOpen}
                    onClose={this.closeOfflineModal}
                    title={translate('components.offlineIndicator.modal.title')}
                    centered
                >
                    <Text size="sm" mb="lg">
                        {translate('components.offlineIndicator.modal.body')}
                    </Text>
                    <Group justify="flex-end" gap="sm">
                        <Button variant="subtle" onClick={this.closeOfflineModal}>
                            {translate('components.offlineIndicator.modal.dismiss')}
                        </Button>
                        <Button color="teal" onClick={this.handleRefreshConnection}>
                            {translate('components.offlineIndicator.modal.refresh')}
                        </Button>
                    </Group>
                </Modal>
            </header>
        );
    }
}

export default withTranslation(connect(mapStateToProps, mapDispatchToProps)(HeaderComponent));
