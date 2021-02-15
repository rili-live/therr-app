/* eslint-disable no-nested-ternary */
import * as React from 'react';
import { Route, withRouter, RouteComponentProps } from 'react-router-dom';
import { connect } from 'react-redux';
import { bindActionCreators, Dispatch } from 'redux';
import RedirectWithStatus from './RedirectWithStatus';

// interface IAuthRouteRouterProps {
// }
interface IAuthRouteProps extends RouteComponentProps<{}> {
    access: any;
    component?: any;
    exact: boolean;
    isAuthorized: boolean;
    redirectPath: string;
    render?: any;
    path: any;
}

type IHomeProps = RouteComponentProps<{}>

const mapStateToProps = (state: any) => ({
});

const mapDispatchToProps = (dispatch: Dispatch) => bindActionCreators(
    {},
    dispatch,
);

class AuthRoute extends React.Component<IAuthRouteProps, any> {
    redirectPath = '/login';

    constructor(props: IAuthRouteProps) {
        super(props);

        const { redirectPath } = this.props;

        if (redirectPath) {
            this.redirectPath = redirectPath;
        }
    }

    render() {
        const {
            exact, isAuthorized, location, path,
        } = this.props;
        const routeProps = { ...this.props };
        delete routeProps.access;
        delete routeProps.component;

        return (
            <Route location={location} path={path} exact={exact} render={(props) => (
                isAuthorized
                    ? (
                        this.props.render ? this.props.render(props) : <this.props.component {...props}/>
                    )
                    : (
                        <RedirectWithStatus
                            statusCode={307}
                            to={{
                                pathname: this.redirectPath,
                                state: { from: props.location },
                            }}
                        />
                    )
            )}/>
        );
    }
}

export default withRouter(connect(mapStateToProps, mapDispatchToProps)(AuthRoute));
