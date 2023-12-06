import * as React from 'react';
import { bindActionCreators, Dispatch } from 'redux';
import { connect } from 'react-redux';
import { Location, NavigateFunction } from 'react-router-dom';
import { TransitionGroup } from 'react-transition-group';
import ReactGA from 'react-ga4';
import { AccessLevels } from 'therr-js-utilities/constants';
import {
    IMessagesState, IUserState, AccessCheckType, IMapState,
} from 'therr-react/types';
import {
    SvgButton,
} from 'therr-react/components';
import {
    NotificationActions, SocketActions, MapActions, MessageActions,
} from 'therr-react/redux/actions';
import { UsersService } from 'therr-react/services';
// import { Loader } from '../library/loader';
import classNames from 'classnames';
import { Toast, ToastContainer, ToastProps } from 'react-bootstrap';
import Header from './Header';
import initInterceptors from '../interceptors';
import * as globalConfig from '../../../global-config';
import { INavMenuContext } from '../types';
import Footer from './footer/Footer';
import DashboardFooter from './DashboardFooter';
import UserMenu from './nav-menu/UserMenu';
import MessagesMenu from './nav-menu/MessagesMenu';
import { socketIO, updateSocketToken } from '../socket-io-middleware';
import { IMessagingContext } from './footer/MessagingContainer';
import UsersActions from '../redux/actions/UsersActions';
import { routeAfterLogin } from '../routes/Login';
import withNavigation from '../wrappers/withNavigation';
import AppRoutes from './AppRoutes';
import Preloader from './Preloader';
import Sidebar from './Sidebar';
import DashboardNavbar from './DashboardNavbar';
import { getBrandContext } from '../utilities/getHostContext';
import translator from '../services/translator';

interface ILayoutRouterProps {
    navigation: {
        navigate: NavigateFunction;
    }
    location: Location;
}

interface ILayoutDispatchProps {
    // Add your dispatcher properties here
    login: Function;
    logout: Function;
    refreshConnection: Function;
    searchDms: Function;
    searchNotifications: Function;
    getPlacesSearchAutoComplete: Function;
    setSearchDropdownVisibility: Function;
}

interface IStoreProps extends ILayoutDispatchProps {
    map?: IMapState;
    messages?: IMessagesState;
    user?: IUserState;
}

interface ILayoutProps extends ILayoutRouterProps, IStoreProps {
    // Add your regular properties here
}

interface ILayoutState {
    alertHeading: string;
    alertMessage: string;
    alertVariation: ToastProps['bg'];
    alertIsVisible: boolean;
    clientHasLoaded: boolean;
    isNavMenuOpen: boolean;
    isNavMenuExpanded: boolean;
    navMenuContext?: INavMenuContext;
    isAuthenticated: boolean;
    isMessagingOpen: boolean;
    isMsgContainerOpen: boolean;
    isSidebarCompact: boolean;
    messagingContext?: IMessagingContext;
}

const mapStateToProps = (state: any) => ({
    map: state.map,
    messages: state.messages,
    redirectRoute: state.redirectRoute,
    user: state.user,
});

const mapDispatchToProps = (dispatch: Dispatch) => bindActionCreators({
    login: UsersActions.login,
    logout: UsersActions.logout,
    searchDms: MessageActions.searchDMs,
    refreshConnection: SocketActions.refreshConnection,
    searchNotifications: NotificationActions.search,
    getPlacesSearchAutoComplete: MapActions.getPlacesSearchAutoComplete,
    setSearchDropdownVisibility: MapActions.setSearchDropdownVisibility,
}, dispatch);

// TODO: Animation between view change is not working when wrapped around a Switch
export class LayoutComponent extends React.Component<ILayoutProps, ILayoutState> {
    private throttleTimeoutId;

    private translate;

    constructor(props: ILayoutProps, state: ILayoutState) {
        super(props);

        this.state = {
            alertHeading: 'Success!',
            alertMessage: '',
            alertVariation: 'success',
            alertIsVisible: false,
            clientHasLoaded: false,
            isAuthenticated: false,
            isNavMenuOpen: false,
            isNavMenuExpanded: false,
            isMessagingOpen: false,
            isMsgContainerOpen: false,
            isSidebarCompact: false,
        };

        this.translate = (key: string, params: any) => translator('en-us', key, params);
    }

    componentDidMount() {
        const {
            navigation,
            refreshConnection,
            searchNotifications,
            user,
        } = this.props;

        // TODO: Check if this should be initialized in index with history passed as argument
        // Initialize global interceptors such as 401, 403
        initInterceptors(navigation.navigate, undefined, 300);

        ReactGA.initialize(globalConfig[process.env.NODE_ENV].googleAnalyticsKeyDashboard);

        document.addEventListener('click', this.handleClick);
        this.setState({
            clientHasLoaded: true,
        });

        if (user && user.details && user.details.idToken) {
            searchNotifications({
                filterBy: 'userId',
                query: user.details.id,
                itemsPerPage: 20,
                pageNumber: 1,
                order: 'desc',
            });
        }

        socketIO.on('reconnect_attempt', () => {
            // Only send event when user is already logged in and refreshes the page
            updateSocketToken(user);
        });

        socketIO.on('reconnect', () => {
            // Only send event when user is already logged in and refreshes the page
            if (user && user.isAuthenticated) {
                refreshConnection(user);
            }
        });

        const { location, login } = this.props;

        const urlParams = new URLSearchParams(location?.search);

        // TODO: Get/Set integrations in browser localStorage to check session
        // Include ttl on JSON entries
        if (location.pathname?.includes('oauth2/facebook-instagram')) {
            const searchParams = [...urlParams.entries()].reduce((a, c) => ({
                ...a,
                [c[0]]: c[1],
            }), {});

            if (urlParams.get('error') || !urlParams.get('code')) {
                console.log(urlParams.get('error'));
                console.log(urlParams.get('error_reason'));
                console.log(urlParams.get('error_description'));
            }

            const userAuthCodeSplit = (urlParams.get('code') || '').split('#_');
            const userAuthCode = userAuthCodeSplit[0] || urlParams.get('code') || '';

            login({
                ...searchParams,
                isSSO: true,
                ssoProvider: 'facebook-instagram',
                ssoPlatform: 'web',
                idToken: userAuthCode,
                isDashboard: true,
                rememberMe: true,
            }).catch((error: any) => {
                if (error.statusCode === 401 || error.statusCode === 404) {
                    this.toggleAlert(true, 'Error Authenticating', 'danger', error.message);
                } else if (error.statusCode === 403 && error.message === 'One-time password has expired') {
                    this.toggleAlert(true, 'Token Expired', 'danger', this.translate('components.loginForm.oneTimePasswordExpired'));
                } else if (error.statusCode === 429 && error.message === 'Too many login attempts, please try again later.') {
                    this.toggleAlert(true, 'Too Many Requests', 'danger', this.translate('components.loginForm.tooManyRequests'));
                } else {
                    this.toggleAlert(true, 'Oops! Something went wrong', 'danger', this.translate('components.loginForm.backendErrorMessage'));
                }
                setTimeout(() => {
                    this.toggleAlert(false);
                    navigation.navigate(routeAfterLogin);
                }, 2000);
            });
        }
    }

    componentDidUpdate() {
        if (this.props.user?.isAuthenticated !== this.state.isAuthenticated) {
            if (this.props.user.isAuthenticated) {
                this.props.searchNotifications({
                    filterBy: 'userId',
                    query: this.props.user.details.id,
                    itemsPerPage: 20,
                    pageNumber: 1,
                    order: 'desc',
                });
            }
            this.setState({
                isAuthenticated: this.props.user.isAuthenticated,
            });
        }
    }

    componentWillUnmount() { // eslint-disable-line
        document.removeEventListener('click', this.handleClick);
    }

    handleClick = (event: any) => {
        if (this.state.isNavMenuOpen) {
            const navMenuEl = document.getElementById('nav_menu');
            const isClickInsideNavMenu = navMenuEl.contains(event.target)
                || document.getElementById('footer_messages').contains(event.target)
                || document.getElementById('header_account_button').contains(event.target);

            if (!isClickInsideNavMenu) {
                this.toggleNavMenu(event);
            }
        }
    };

    handleWidthResize = (shouldExpand) => {
        this.setState({
            isNavMenuExpanded: shouldExpand,
        });
    };

    toggleNavMenu = (event, context?: string) => {
        const newState: any = {
            isNavMenuOpen: !this.state.isNavMenuOpen,
        };
        if (this.state.isNavMenuOpen) {
            this.handleWidthResize(false);
        }
        if (context) {
            newState.navMenuContext = context;
        }
        const navMenuEl = document.getElementById('nav_menu');
        this.setState(newState, () => {
            if (this.state.isNavMenuOpen) {
                const activeTabEl = navMenuEl && navMenuEl
                    .getElementsByClassName('nav-menu-header')[0]
                    .getElementsByClassName('menu-tab-button active')[0] as HTMLElement;
                activeTabEl.focus();
            }
        });
    };

    toggleMessaging = (event, overrideAndClose = false) => {
        this.setState({
            isMsgContainerOpen: overrideAndClose ? false : !this.state.isMsgContainerOpen,
        });
    };

    goHome = () => {
        const isAuthorized = UsersService.isAuthorized(
            {
                type: AccessCheckType.ALL,
                levels: [AccessLevels.DEFAULT],
            },
            this.props.user,
        );

        if (!isAuthorized) {
            this.props.navigation.navigate('/');
        } else {
            this.props.navigation.navigate(routeAfterLogin);
        }
    };

    handleLogout = (e) => {
        const { logout, user } = this.props;

        // this.toggleNavMenu(e);
        logout(user.details);
    };

    toggleSidebar = () => {
        this.setState({
            isSidebarCompact: !this.state.isSidebarCompact,
        });
    };

    onSearchInpuChange = (event) => {
        event.preventDefault();
        const { name, value } = event.currentTarget;

        const { getPlacesSearchAutoComplete, map, setSearchDropdownVisibility } = this.props;

        clearTimeout(this.throttleTimeoutId);

        this.throttleTimeoutId = setTimeout(() => {
            getPlacesSearchAutoComplete({
                longitude: map?.longitude || '37.76999',
                latitude: map?.latitude || '-122.44696',
                // radius,
                input: value,
            });
        }, 500);

        setSearchDropdownVisibility(!!value?.length);
    };

    navToSettings = () => {
        this.props.navigation.navigate('/settings');
    };

    initMessaging = (e, connectionDetails, context) => {
        const { searchDms, messages } = this.props;
        const { isMessagingOpen, isMsgContainerOpen } = this.state;

        if (!messages.dms[connectionDetails.id]) {
            searchDms({
                filterBy: 'fromUserId',
                query: connectionDetails.id,
                itemsPerPage: 200,
                pageNumber: 1,
                orderBy: 'interactionCount',
                order: 'desc',
                shouldCheckReverse: true,
            }, connectionDetails);
        }

        const newState: any = {
            isNavMenuOpen: false,
            messagingContext: connectionDetails,
            isMsgContainerOpen: true,
        };

        if (!isMessagingOpen) {
            newState.isMessagingOpen = true;
        } else {
            newState.isMsgContainerOpen = true;
        }

        this.setState(newState);
    };

    isSuperAdmin = () => UsersService.isAuthorized(
        {
            type: AccessCheckType.ALL,
            levels: [AccessLevels.SUPER_ADMIN],
        },
        this.props.user,
    );

    toggleAlert = (show?: boolean, alertHeading = 'Success!', alertVariation: ToastProps['bg'] = 'success', alertMessage = '') => {
        const alertIsVisible = show !== undefined ? show : !this.state.alertIsVisible;
        if (!alertIsVisible) {
            this.setState({
                alertIsVisible,
            });
        } else {
            this.setState({
                alertIsVisible,
                alertHeading,
                alertVariation,
                alertMessage: alertMessage || this.state.alertMessage,
            });
        }
    };

    renderNavMenuContent = () => {
        const brandContext = getBrandContext();

        const { navMenuContext } = this.state;

        if (navMenuContext === INavMenuContext.HEADER_PROFILE) {
            return (
                <UserMenu
                    handleLogout={this.handleLogout}
                    handleWidthResize={this.handleWidthResize}
                    toggleNavMenu={this.toggleNavMenu}
                />
            );
        }

        if (navMenuContext === INavMenuContext.FOOTER_MESSAGES) {
            return (
                <MessagesMenu
                    toggleNavMenu={this.toggleNavMenu}
                    toggleMessaging={this.toggleMessaging}
                    onInitMessaging={this.initMessaging}
                />
            );
        }

        return (
            <>
                <p>{brandContext.brandName}</p>
                <p>Under Construction</p>
                <p>Check back soon for updates</p>
                <div className="nav-menu-footer">
                    <SvgButton id="nav_menu_footer_close" name="close" className="close-button" onClick={(e) => this.toggleNavMenu(e)} buttonType="primary" />
                </div>
            </>
        );
    };

    renderHeader = (isLandingStylePage?: boolean) => (
        <Header
            goHome={this.goHome}
            isAuthorized={
                UsersService.isAuthorized(
                    {
                        type: AccessCheckType.ALL,
                        levels: ['user.default'],
                    },
                    this.props.user,
                )
            }
            toggleNavMenu={this.toggleNavMenu}
            isLandingStylePage={isLandingStylePage}
        />
    );

    renderFooter = (isLandingStylePage?: boolean) => {
        const { isMessagingOpen, isMsgContainerOpen, messagingContext } = this.state;

        return (
            <Footer
                goHome={this.goHome}
                isAuthorized={
                    UsersService.isAuthorized(
                        {
                            type: AccessCheckType.ALL,
                            levels: ['user.default'],
                        },
                        this.props.user,
                    )
                }
                isMessagingOpen={isMessagingOpen}
                isMsgContainerOpen={isMsgContainerOpen}
                messagingContext={messagingContext}
                toggleNavMenu={this.toggleNavMenu}
                toggleMessaging={this.toggleMessaging}
                isLandingStylePage={isLandingStylePage}
            />
        );
    };

    public render(): JSX.Element | null {
        const { location, map, user } = this.props;
        const {
            alertHeading,
            alertMessage,
            alertVariation,
            alertIsVisible,
            isSidebarCompact,
        } = this.state;
        const navMenuClassNames = classNames({
            'is-open': this.state.isNavMenuOpen,
            'is-expanded': this.state.isNavMenuExpanded,
        });
        // TODO: Make sure header/footer is re-rendered if isLandingStylePage changes
        const isLandingStylePage = location.pathname === '/'
            || location.pathname === '/login'
            || location.pathname === '/register'
            || location.pathname === '/verify-account'
            || location.pathname === '/reset-password';
        const isMinimumAuthorized = UsersService.isAuthorized(
            {
                type: AccessCheckType.ALL,
                levels: ['user.default'],
            },
            this.props.user,
        );
        const shouldShowSidebar = !isLandingStylePage && isMinimumAuthorized;
        // Cloak the view so it doesn't flash before client mounts
        const mainClassNames = classNames({
            content: shouldShowSidebar,
        });
        if (this.state.clientHasLoaded) {
            return (
                <>
                    {/* <AccessControl isAuthorized={UsersService.isAuthorized({ type: AccessCheckType.ALL, levels: ['user.default'] }, this.props.user)}>
                        <div id="nav_menu" className={navMenuClassNames}>
                            {this.renderNavMenuContent()}
                        </div>
                    </AccessControl> */}
                    <TransitionGroup
                        appear
                        enter
                        exit
                        component="div"
                        className={ isLandingStylePage ? 'content-container-home view' : 'content-container view' }
                    >
                        <Preloader show={!this.state.clientHasLoaded} />
                        <Sidebar
                            isContracted={isSidebarCompact}
                            isSuperAdmin={this.isSuperAdmin()}
                            onLogout={this.handleLogout}
                            show={shouldShowSidebar}
                            user={user}
                        />
                        <main className={mainClassNames}>
                            {
                                shouldShowSidebar
                                && <DashboardNavbar
                                    map={map}
                                    onLogout={this.handleLogout}
                                    onSearchInpuChange={this.onSearchInpuChange}
                                    navToSettings={this.navToSettings}
                                    toggleSidebar={this.toggleSidebar}
                                    user={user}
                                />
                            }
                            <AppRoutes
                                initMessaging={this.initMessaging}
                                isAuthorized={(access) => UsersService.isAuthorized(access, user)}
                            />
                            <DashboardFooter
                                toggleSettings={() => { console.log('toggleSettings'); }}
                                showSettings={false}
                                isLandingStylePage={isLandingStylePage}
                            />
                        </main>
                    </TransitionGroup>
                    <ToastContainer className="p-3" position={'bottom-end'}>
                        <Toast bg={alertVariation} show={alertIsVisible && !!alertMessage} onClose={() => this.toggleAlert(false)}>
                            <Toast.Header>
                                <img src="holder.js/20x20?text=%20" className="rounded me-2" alt="" />
                                <strong className="me-auto">{alertHeading}</strong>
                                {/* <small>11 mins ago</small> */}
                            </Toast.Header>
                            <Toast.Body>{alertMessage}</Toast.Body>
                        </Toast>
                    </ToastContainer>

                    {/* <Alerts></Alerts> */}
                    {/* <Loader></Loader> */}
                </>
            );
        }
        // Opportunity to add a loader of graphical display
        return null;
    }
}

// export default Layout;
export default withNavigation(connect<any, IStoreProps, {}>(mapStateToProps, mapDispatchToProps)(LayoutComponent as any));
