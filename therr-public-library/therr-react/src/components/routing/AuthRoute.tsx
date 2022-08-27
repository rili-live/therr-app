/* eslint-disable no-nested-ternary */
import * as React from 'react';
import { Route, RouteProps } from 'react-router-dom';
import { connect } from 'react-redux';
import { bindActionCreators, Dispatch } from 'redux';
import RedirectWithStatus from './RedirectWithStatus';
import withNavigation from '../../wrappers/withNavigation';

// interface IAuthRouteRouterProps {
// }
// eslint-disable-next-line @typescript-eslint/ban-types
interface IAuthRouteProps extends RouteProps {
    component?: any;
    isAuthorized: boolean;
    redirectPath: string;
    render?: any;
    path: any;
}

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
            isAuthorized,
            path,
        } = this.props;
        const routeProps = { ...this.props };
        delete routeProps.component;

        return (
            <Route path={path} element={(props) => (
                isAuthorized
                    ? (
                        this.props.render ? this.props.render(props) : <this.props.component {...props}/>
                    )
                    : (
                        <RedirectWithStatus
                            statusCode={307}
                            to={{
                                pathname: this.redirectPath,
                            }}
                            from={props.location}
                        />
                    )
            )}/>
        );
    }
}

export default withNavigation(connect(mapStateToProps, mapDispatchToProps)(AuthRoute));
