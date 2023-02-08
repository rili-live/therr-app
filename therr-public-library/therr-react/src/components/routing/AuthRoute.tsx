/* eslint-disable no-nested-ternary */
import * as React from 'react';
import { RouteProps } from 'react-router-dom';
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
    location: string;
    redirectPath: string;
    render?: any;
}

const mapStateToProps = (state: any) => ({
});

const mapDispatchToProps = (dispatch: Dispatch) => bindActionCreators(
    {},
    dispatch,
);

const RouteComponent = (props: IAuthRouteProps) => (
    props.isAuthorized
        ? (
            props.render ? props.render(props) : <props.component {...props}/>
        )
        : (
            <RedirectWithStatus
                statusCode={307}
                to={{
                    pathname: props.redirectPath,
                }}
            />
        )
);

class AuthRoute extends React.Component<IAuthRouteProps, any> {
    redirectPath = '/login';

    render() {
        const { redirectPath } = this.props;

        if (redirectPath) {
            this.redirectPath = redirectPath;
        }

        return (
            <RouteComponent { ...this.props } redirectPath={this.redirectPath} />
        );
    }
}

export default withNavigation(connect(mapStateToProps, mapDispatchToProps)(AuthRoute));
