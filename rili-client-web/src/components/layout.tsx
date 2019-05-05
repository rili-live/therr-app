import classnames from 'classnames';
import * as React from 'react';
import { bindActionCreators, Dispatch } from 'redux';
import { connect } from 'react-redux';
import { Route, Switch, withRouter, RouteComponentProps } from 'react-router-dom';
import { TransitionGroup as Animation } from 'react-transition-group';
// import * as ReactGA from 'react-ga';
// import TopNav from './pieces/TopNav';
// import { configureAuthRoute } from '../library/authentication';
import { ISocketState } from 'types/socket';
import RedirectWithStatus from 'rili-public-library/react-components/RedirectWithStatus';
import SvgButton from 'rili-public-library/react-components/SvgButton';
// import { Alerts } from '../library/alerts'
// import { Loader } from '../library/loader';
import scrollTo from 'rili-public-library/utilities/scroll-to';
import initInterceptors from '../interceptors';
// import roleConfig from '../../roleConfig';
import * as globalConfig from '../../../global-config.js';
// const AuthRoute = configureAuthRoute(roleConfig);
import routes from '../routes';
import { Location } from 'history';

let _viewListener: any;

interface ILayoutRouterProps {

}

interface ILayoutDispatchProps {
    // Add your dispatcher properties here
}

interface IStoreProps extends ILayoutDispatchProps {
    socket?: ISocketState;
}

interface ILayoutProps extends RouteComponentProps<ILayoutRouterProps>, IStoreProps {
    // Add your regular properties here
}

interface ILayoutState {
    clientHasLoaded: boolean;
    isNavMenuOpen: boolean;
}

const mapStateToProps = (state: any) => {
    return {
        'redirectRoute': state.redirectRoute
    };
};

const mapDispatchToProps = (dispatch: Dispatch) => {
    return bindActionCreators({

    }, dispatch);
};

// TODO: Animation between view change is not working when wrapped around a Switch
export class Layout extends React.Component<ILayoutProps, ILayoutState> {
    constructor(props: ILayoutProps, state: ILayoutState) {
        super(props);

        this.state = {
            clientHasLoaded: false,
            isNavMenuOpen: false,
        };
    }

    componentWillMount() {
        // TODO: Check if this should be initialized in index with history passed as argument
        // Initialize global interceptors such as 401, 403
        initInterceptors(this.props.history, globalConfig.baseApiRoute, 300);
        _viewListener = this.props.history.listen((location: Location, action: any) => {
            this.onViewChange(location);
        });
    }

    componentDidMount() {
        // ReactGA.initialize(globalConfig[process.env.NODE_ENV].googleAnalyticsKey);
        document.addEventListener('click', this.handleClick);
        this.setState({
            'clientHasLoaded': true
        });
    }

    handleClick = (event: any) => {
        if (this.state.isNavMenuOpen) {
            const isClickInsideNavMenu = document.getElementById('navMenu').contains(event.target);

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

    public render(): JSX.Element | null {
        const navMenuClassNames = classnames({
            'is-open': this.state.isNavMenuOpen,
        });
        // Cloak the view so it doesn't flash before client mounts
        if (this.state.clientHasLoaded) {
            return (
                <div>
                    <header>
                        <div className="login-link"><a href="/login">Login</a></div>
                    </header>
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
                                            <Route location={this.props.location} key={i} {...route} />
                                        );
                                    } else {
                                        return (
                                            <Route location={this.props.location} key={i} {...route} />
                                        );
                                    }
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
                            <SvgButton id="messages" name="messages" className="messages-button" onClick={this.toggleNavMenu} buttonType="primary" />
                        </div>
                    </footer>
                </div>
            );
        } else {
            // Opportunity to add a loader of graphical display
            return (
                <div>
                    <header></header>
                </div>
            );
        }
    }

    componentWillUnmount() {
        _viewListener();
    }
}

// export default Layout;
export default withRouter(connect(mapStateToProps, mapDispatchToProps)(Layout));