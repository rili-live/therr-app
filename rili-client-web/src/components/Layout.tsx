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
import { IAccess, AccessCheckType } from '../types';
import UserService from '../services/UserService';

let _viewListener: any; // eslint-disable-line no-underscore-dangle

interface ILayoutRouterProps {

}

interface ILayoutDispatchProps {
    // Add your dispatcher properties here
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
}

const mapStateToProps = (state: any) => ({
    redirectRoute: state.redirectRoute,
    user: state.user,
});

const mapDispatchToProps = (dispatch: Dispatch) => bindActionCreators({

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
        // TODO: Check if this should be initialized in index with history passed as argument
        // Initialize global interceptors such as 401, 403
        initInterceptors(this.props.history, globalConfig.baseApiRoute, 300);
        _viewListener = this.props.history.listen((location: Location, action: any) => {
            this.onViewChange(location);
        });

        // ReactGA.initialize(globalConfig[process.env.NODE_ENV].googleAnalyticsKey);
        document.addEventListener('click', this.handleClick);
        this.setState({
            clientHasLoaded: true,
        });
    }

    componentWillUnmount() { // eslint-disable-line
        _viewListener();
    }

    handleClick = (event: any) => {
        if (this.state.isNavMenuOpen) {
            const isClickInsideNavMenu = document.getElementById('navMenu').contains(event.target)
                || document.getElementById('messages').contains(event.target);

            if (!isClickInsideNavMenu) {
                this.toggleNavMenu();
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

    toggleNavMenu = () => {
        this.setState({
            isNavMenuOpen: !this.state.isNavMenuOpen,
        });
    }

    goHome = () => {
        this.props.history.push('/');
    }

    renderHeader = () => (
        <Header
            goHome={this.goHome}
            isAuthorized={
                UserService.isAuthorized(
                    {
                        type: AccessCheckType.ALL,
                        levels: ['user.default'],
                    },
                    this.props.user,
                )
            }
        />
    )

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
                    <div id="navMenu" className={navMenuClassNames}>
                        <p>Rili Inc.</p>
                        <p>Under Construction</p>
                        <p>Check back soon for updates</p>
                        <div className="nav-menu-footer">
                            <SvgButton id="close" name="close" className="close-button" onClick={this.toggleNavMenu} buttonType="primary" />
                        </div>
                    </div>

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
                                                isAuthorized={UserService.isAuthorized(route.access, user)}
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

                    <footer>
                        <div className="footer-menu-item">
                        </div>
                        <div className="footer-menu-item">
                            <SvgButton id="home" name="home" className="home-button" onClick={this.goHome} buttonType="primary" />
                        </div>
                        <div className="footer-menu-item">
                            <SvgButton
                                id="messages"
                                name="messages"
                                className="messages-button"
                                onClick={this.toggleNavMenu}
                                buttonType="primary"
                            />
                        </div>
                    </footer>
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
