import * as React from 'react';
import { Route, Switch, withRouter } from 'react-router-dom';
import { TransitionGroup as Animation } from 'react-transition-group';
// import * as ReactGA from 'react-ga';
// import TopNav from './pieces/TopNav';
// import { configureAuthRoute } from '../library/authentication';
import { RedirectWithStatus } from 'rili-public-library/react-components/redirect-with-status'; // tslint:disable-line no-implicit-dependencies
// import { Alerts } from '../library/alerts'
// import { Loader } from '../library/loader';
import { scrollTo } from 'rili-public-library/utilities/scroll-to'; // tslint:disable-line no-implicit-dependencies
import initInterceptors from '../interceptors';
// import roleConfig from '../../roleConfig';
import * as globalConfig from '../../../global-config.js';
// const AuthRoute = configureAuthRoute(roleConfig);
import routes from '../routes';

let _viewListener: any;

// TODO: Animation between view change is not working when wrapped around a Switch

class Layout extends React.Component<any, any> {
    constructor(props: any) {
        super(props);

        this.state = {
            'clientHasLoaded': false
        };

        this.onViewChange = this.onViewChange.bind(this);
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
        this.setState({
            'clientHasLoaded': true
        });
    }

    onViewChange(location: Location) {
        scrollTo(0, 100);
        // if (typeof(window) !== 'undefined') {
        //     ReactGA.set({ 'page': window.location.pathname });
        //     ReactGA.pageview(window.location.pathname);
        // }
    }

    render() {
        // Cloak the view so it doesn't flash before client mounts
        if (this.state.clientHasLoaded) {
            return (
                <div>
                    <header>
                        Header
                        {/* <TopNav/> */}
                    </header>

                    <Animation
                        transitionName="view"
                        transitionAppear={true}
                        transitionAppearTimeout={250}
                        transitionEnter={true}
                        transitionEnterTimeout={250}
                        transitionLeave={true}
                        transitionLeaveTimeout={250}
                        component="div"
                        className="content-container"
                    >
                        <Switch>
                            {routes.map((route, i) => {
                                if (route.access) {
                                    return (
                                        <Route location={this.props.location} key={i} {...route}/>
                                        // <AuthRoute location={this.props.location} key={i} {...route}/>
                                    );
                                } else {
                                    return (
                                        <Route location={this.props.location} key={i} {...route}/>
                                    );
                                }
                            })}
                            <RedirectWithStatus from="/redirect" to="/" />
                        </Switch>
                    </Animation>

                    {/* <Alerts></Alerts> */}
                    {/* <Loader></Loader> */}

                    <footer>This is the footer.</footer>
                </div>
            );
        } else {
            // Opportunity to add a loader of graphical display
            return (
                <div>
                    <header>
                        Header
                        {/* <TopNav/> */}
                    </header>
                </div>
            );
        }
    }

    componentWillUnmount() {
        _viewListener();
    }
}

export default withRouter(Layout);