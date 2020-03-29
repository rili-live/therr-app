import classnames from 'classnames';
import * as React from 'react';
import { bindActionCreators, Dispatch } from 'redux';
import { connect } from 'react-redux';
import {
    Route, Switch, withRouter, RouteComponentProps,
} from 'react-router-dom';
import { TransitionGroup as Animation } from 'react-transition-group';
import { Location } from 'history';
// import * as ReactGA from 'react-ga';
import { ISocketState } from 'types/socket';
import { IUserState } from 'types/user';
import AccessControl from 'rili-public-library/react-components/AccessControl.js';
import AuthRoute from 'rili-public-library/react-components/AuthRoute.js';
import RedirectWithStatus from 'rili-public-library/react-components/RedirectWithStatus.js';
import SvgButton from 'rili-public-library/react-components/SvgButton.js';
// import { Alerts } from '../library/alerts'
// import { Loader } from '../library/loader';
import scrollTo from 'rili-public-library/utilities/scroll-to.js';
import Header from './Header';
import initInterceptors from '../interceptors';
import * as globalConfig from '../../../global-config.js';
import routes from '../routes';
import { AccessCheckType, INavMenuContext } from '../types';
import UsersService from '../services/UsersService';
import Footer from './Footer';
import { NotificationActions, SocketActions } from '../redux/actions';
import UserMenu from './nav-menu/UserMenu';
import MessagesMenu from './nav-menu/MessagesMenu';

let _viewListener: any; // eslint-disable-line no-underscore-dangle

interface ILayoutRouterProps {

}

interface ILayoutDispatchProps {
    // Add your dispatcher properties here
    logout: Function;
    searchNotifications: Function;
}

interface IStoreProps extends ILayoutDispatchProps {
    user?: IUserState;
    socket?: ISocketState;
}

interface ILayoutProps extends RouteComponentProps<ILayoutRouterProps>, IStoreProps {
    // Add your regular properties here
}

interface ILayoutState {
    clientHasLoaded: boolean;
    isNavMenuOpen: boolean;
    navMenuContext?: INavMenuContext;
}

const mapStateToProps = (state: any) => ({
    redirectRoute: state.redirectRoute,
    user: state.user,
});

const mapDispatchToProps = (dispatch: Dispatch) => bindActionCreators({
    searchNotifications: NotificationActions.search,
    logout: SocketActions.logout,
}, dispatch);

// TODO: Animation between view change is not working when wrapped around a Switch
export class LayoutComponent extends React.Component<ILayoutProps, ILayoutState> {
    constructor(props: ILayoutProps, state: ILayoutState) {
        super(props);

        this.state = {
            clientHasLoaded: false,
            isNavMenuOpen: false,
        };
    }

    componentDidMount() {
        const {
            history,
            searchNotifications,
            user,
        } = this.props;
        // TODO: Check if this should be initialized in index with history passed as argument
        // Initialize global interceptors such as 401, 403
        initInterceptors(history, globalConfig.baseApiRoute, 300);
        _viewListener = history.listen((location: Location, action: any) => {
            this.onViewChange(location);
        });

        // ReactGA.initialize(globalConfig[process.env.NODE_ENV].googleAnalyticsKey);
        document.addEventListener('click', this.handleClick);
        this.setState({
            clientHasLoaded: true,
        });

        searchNotifications({
            filterBy: 'userId',
            query: user.details.id,
            itemsPerPage: 20,
            pageNumber: 1,
        });
    }

    componentWillUnmount() { // eslint-disable-line
        _viewListener();
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

    toggleNavMenu = (event, context?: string) => {
        const newState: any = {
            isNavMenuOpen: !this.state.isNavMenuOpen,
        };
        if (context) {
            newState.navMenuContext = context;
        }
        this.setState(newState);
    }

    goHome = () => {
        this.props.history.push('/');
    }

    handleLogout = (e) => {
        const { logout, user } = this.props;

        this.toggleNavMenu(e);
        logout(user.details);
    };

    renderNavMenuContent = () => {
        const { navMenuContext } = this.state;

        if (navMenuContext === INavMenuContext.HEADER_PROFILE) {
            return (
                <UserMenu handleLogout={this.handleLogout} toggleNavMenu={this.toggleNavMenu} />
            );
        }

        if (navMenuContext === INavMenuContext.FOOTER_MESSAGES) {
            return (
                <MessagesMenu toggleNavMenu={this.toggleNavMenu} />
            );
        }

        return (
            <>
                <p>Rili Inc.</p>
                <p>Under Construction</p>
                <p>Check back soon for updates</p>
                <div className="nav-menu-footer">
                    <SvgButton id="nav_menu_footer_close" name="close" className="close-button" onClick={(e) => this.toggleNavMenu(e)} buttonType="primary" />
                </div>
            </>
        );
    }

    renderHeader = () => (
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
        />
    )

    renderFooter = () => (
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
            toggleNavMenu={this.toggleNavMenu}
        />
    );

    public render(): JSX.Element | null {
        const { location, user } = this.props;
        const navMenuClassNames = classnames({
            'is-open': this.state.isNavMenuOpen,
        });
        // Cloak the view so it doesn't flash before client mounts
        if (this.state.clientHasLoaded) {
            return (
                <>
                    {this.renderHeader()}
                    <AccessControl isAuthorized={UsersService.isAuthorized({ type: AccessCheckType.ALL, levels: ['user.default'] }, this.props.user)}>
                        <div id="nav_menu" className={navMenuClassNames}>
                            {this.renderNavMenuContent()}
                        </div>
                    </AccessControl>
                    <Animation
                        appear={true}
                        enter={true}
                        exit={true}
                        component="div"
                        className="content-container view"
                    >
                        <Switch>
                            {
                                routes.map((route, i) => {
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
                            <RedirectWithStatus from="/redirect" to="/" />
                        </Switch>
                    </Animation>

                    {/* <Alerts></Alerts> */}
                    {/* <Loader></Loader> */}

                    { this.renderFooter() }
                </>
            );
        }
        // Opportunity to add a loader of graphical display
        return (
            <>
                {this.renderHeader()}
            </>
        );
    }
}

// export default Layout;
export default withRouter(connect(mapStateToProps, mapDispatchToProps)(LayoutComponent));
