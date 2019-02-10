import * as React from 'react';
import { bindActionCreators, Dispatch } from 'redux';
import { connect } from 'react-redux';
import { Route, Switch, withRouter, RouteComponentProps } from 'react-router-dom';
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
import { Location } from 'history';

let _viewListener: any;

const mapStateToProps = (state: any) => {
    return {
        'redirectRoute': state.redirectRoute
    };
};

const mapDispatchToProps = (dispatch: Dispatch) => {
    return bindActionCreators({

    }, dispatch);
};

interface ILayoutRouterProps {

}

interface ILayoutProps extends RouteComponentProps {

}

interface ILayoutProps extends RouteComponentProps<ILayoutRouterProps> {
// Add your regular properties here
}

interface ILayoutDispatchProps {
// Add your dispatcher properties here
}

// interface ILayoutState {
// }

// TODO: Animation between view change is not working when wrapped around a Switch
class Layout extends React.Component<ILayoutProps & ILayoutDispatchProps, any> {
    constructor(props: ILayoutProps) {
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
                        appear={true}
                        enter={true}
                        exit={true}
                        timeout={{
                            enter: 250,
                            exit: 250
                        }}
                        component="div"
                        className="content-container view"
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

export default withRouter(connect(mapStateToProps, mapDispatchToProps)(Layout));