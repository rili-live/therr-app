import classnames from 'classnames';
import * as React from 'react';
import { bindActionCreators, Dispatch } from 'redux';
import { connect } from 'react-redux';
import {
    Route, Switch, withRouter, RouteComponentProps,
} from 'react-router-dom';
import { TransitionGroup } from 'react-transition-group';
import { Location } from 'history';
// import * as ReactGA from 'react-ga';
import { IMessagesState, IUserState, AccessCheckType } from 'therr-react/types';
import {
    AccessControl,
    AuthRoute,
    RedirectWithStatus,
    SvgButton,
} from 'therr-react/components';
import { NotificationActions, SocketActions, MessageActions } from 'therr-react/redux/actions';
import { UsersService } from 'therr-react/services';
// import { Alerts } from '../library/alerts'
// import { Loader } from '../library/loader';
import scrollTo from 'therr-js-utilities/scroll-to';
import Header from './Header';
import initInterceptors from '../interceptors';
// import * as globalConfig from '../../../global-config';
import getRoutes from '../routes';
import { INavMenuContext } from '../types';
import Footer from './footer/Footer';
import UserMenu from './nav-menu/UserMenu';
import MessagesMenu from './nav-menu/MessagesMenu';
import { socketIO, updateSocketToken } from '../socket-io-middleware';
import { IMessagingContext } from './footer/MessagingContainer';
import UsersActions from '../redux/actions/UsersActions';

let _viewListener: any; // eslint-disable-line no-underscore-dangle

interface ILayoutRouterProps {
}

interface ILayoutDispatchProps {
    // Add your dispatcher properties here
    logout: Function;
    refreshConnection: Function;
    searchDms: Function;
    searchNotifications: Function;
}

interface IStoreProps extends ILayoutDispatchProps {
    messages?: IMessagesState;
    user?: IUserState;
}

interface ILayoutProps extends RouteComponentProps<ILayoutRouterProps>, IStoreProps {
    // Add your regular properties here
}

interface ILayoutState {
    clientHasLoaded: boolean;
    isNavMenuOpen: boolean;
    isNavMenuExpanded: boolean;
    navMenuContext?: INavMenuContext;
    isAuthenticated: boolean;
    isMessagingOpen: boolean;
    isMsgContainerOpen: boolean;
    messagingContext?: IMessagingContext;
}

const mapStateToProps = (state: any) => ({
    messages: state.messages,
    redirectRoute: state.redirectRoute,
    user: state.user,
});

const mapDispatchToProps = (dispatch: Dispatch) => bindActionCreators({
    logout: UsersActions.logout,
    searchDms: MessageActions.searchDMs,
    refreshConnection: SocketActions.refreshConnection,
    searchNotifications: NotificationActions.search,
}, dispatch);

// TODO: Animation between view change is not working when wrapped around a Switch
export class LayoutComponent extends React.Component<ILayoutProps, ILayoutState> {
    constructor(props: ILayoutProps, state: ILayoutState) {
        super(props);

        this.state = {
            clientHasLoaded: false,
            isAuthenticated: false,
            isNavMenuOpen: false,
            isNavMenuExpanded: false,
            isMessagingOpen: false,
            isMsgContainerOpen: false,
        };
    }

    componentDidMount() {
        const {
            history,
            refreshConnection,
            searchNotifications,
            user,
        } = this.props;

        // TODO: Check if this should be initialized in index with history passed as argument
        // Initialize global interceptors such as 401, 403
        initInterceptors(history, undefined, 300);
        _viewListener = history.listen((location: Location, action: any) => {
            this.onViewChange(location);
        });

        // ReactGA.initialize(globalConfig[process.env.NODE_ENV].googleAnalyticsKey);
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
        _viewListener();
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
    }

    onViewChange = (location: Location) => {
        scrollTo(0, 100);
        // if (typeof(window) !== 'undefined') {
        //     ReactGA.set({ 'page': window.location.pathname });
        //     ReactGA.pageview(window.location.pathname);
        // }
    }

    handleWidthResize = (shouldExpand) => {
        this.setState({
            isNavMenuExpanded: shouldExpand,
        });
    }

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
    }

    toggleMessaging = (event, overrideAndClose = false) => {
        this.setState({
            isMsgContainerOpen: overrideAndClose ? false : !this.state.isMsgContainerOpen,
        });
    }

    goHome = () => {
        const isAuthorized = UsersService.isAuthorized(
            {
                type: AccessCheckType.ALL,
                levels: ['user.default'],
            },
            this.props.user,
        );

        if (!isAuthorized) {
            this.props.history.push('/');
        } else {
            this.props.history.push('/user/profile');
        }
    }

    handleLogout = (e) => {
        const { logout, user } = this.props;

        this.toggleNavMenu(e);
        logout(user.details);
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
    }

    renderNavMenuContent = () => {
        const { navMenuContext } = this.state;

        if (navMenuContext === INavMenuContext.HEADER_PROFILE) {
            return (
                <UserMenu
                    history={this.props.history}
                    handleLogout={this.handleLogout}
                    handleWidthResize={this.handleWidthResize}
                    toggleNavMenu={this.toggleNavMenu}
                />
            );
        }

        if (navMenuContext === INavMenuContext.FOOTER_MESSAGES) {
            return (
                <MessagesMenu
                    history={this.props.history}
                    toggleNavMenu={this.toggleNavMenu}
                    toggleMessaging={this.toggleMessaging}
                    onInitMessaging={this.initMessaging}
                />
            );
        }

        return (
            <>
                <p>Therr Inc.</p>
                <p>Under Construction</p>
                <p>Check back soon for updates</p>
                <div className="nav-menu-footer">
                    <SvgButton id="nav_menu_footer_close" name="close" className="close-button" onClick={(e) => this.toggleNavMenu(e)} buttonType="primary" />
                </div>
            </>
        );
    }

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
            isLandingStylePage
        />
    )

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
                isLandingStylePage
            />
        );
    };

    public render(): JSX.Element | null {
        const { location, user } = this.props;
        const navMenuClassNames = classnames({
            'is-open': this.state.isNavMenuOpen,
            'is-expanded': this.state.isNavMenuExpanded,
        });
        const isLandingStylePage = location.pathname === '/'
            || location.pathname === '/create-profile'
            || location.pathname === '/login'
            || location.pathname === '/register'
            || location.pathname === '/verify-account'
            || location.pathname === '/reset-password';
        // Cloak the view so it doesn't flash before client mounts
        if (this.state.clientHasLoaded) {
            return (
                <>
                    {this.renderHeader(isLandingStylePage)}
                    <AccessControl isAuthorized={UsersService.isAuthorized({ type: AccessCheckType.ALL, levels: ['user.default'] }, this.props.user)}>
                        <div id="nav_menu" className={navMenuClassNames}>
                            {this.renderNavMenuContent()}
                        </div>
                    </AccessControl>
                    <TransitionGroup
                        appear
                        enter
                        exit
                        component="div"
                        className={ isLandingStylePage ? 'content-container-home view' : 'content-container view' }
                    >
                        <Switch>
                            {
                                getRoutes({ onInitMessaging: this.initMessaging }).map((route: any, i) => {
                                    if (route.access) {
                                        return (
                                            <AuthRoute
                                                isAuthorized={UsersService.isAuthorized(route.access, user)}
                                                location={location}
                                                key={i}
                                                {...route}
                                            />
                                        );
                                    }
                                    return (
                                        <Route location={location} key={i} {...route} />
                                    );
                                })
                            }
                            <RedirectWithStatus from="/redirect" to="/" statusCode="301" />
                        </Switch>
                    </TransitionGroup>

                    {/* <Alerts></Alerts> */}
                    {/* <Loader></Loader> */}

                    { this.renderFooter() }
                </>
            );
        }
        // Opportunity to add a loader of graphical display
        return (
            <>
                {this.renderHeader(isLandingStylePage)}
            </>
        );
    }
}

// export default Layout;
export default withRouter(connect(mapStateToProps, mapDispatchToProps)(LayoutComponent));
