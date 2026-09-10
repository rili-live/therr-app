/* eslint-disable no-nested-ternary */
import * as React from 'react';
import { RouteProps } from 'react-router-dom';
import { connect } from 'react-redux';
import { bindActionCreators, Dispatch } from 'redux';
import RedirectWithStatus from './RedirectWithStatus';
import withNavigation from '../../wrappers/withNavigation';

interface IAuthRouteLocation {
    pathname?: string;
    search?: string;
}

// interface IAuthRouteRouterProps {
// }
type IAuthRouteProps = RouteProps & {
    component?: any;
    isAuthorized: boolean;
    // Injected by withNavigation (react-router's useLocation), never passed by consumers.
    location?: IAuthRouteLocation;
    isUserUnauthenticated?: boolean;
    redirectPath: string;
    render?: any;
};

/**
 * Builds the redirect target for an unauthorized visit, preserving where they were headed
 * as a `returnTo` param so the login/create-profile detour can land them there afterwards.
 * Without it every gated route funnels to the same default page, which is how a deep link
 * into the dashboard (e.g. mobile's API-access screen opening /settings/api-keys) lost its
 * destination the moment the browser turned out to have no session.
 *
 * `returnTo` is attached ONLY when the redirect is caused by having no session. An
 * authenticated-but-under-privileged user must get the bare redirectPath: Login forwards an
 * already-authenticated visitor straight to `returnTo`, which would bounce off this same
 * check and loop forever. Landing them on the default page is the terminating case.
 */
export const getRedirectTo = (props: {
    isUserUnauthenticated?: boolean;
    location?: IAuthRouteLocation;
    redirectPath: string;
}): { pathname: string; search?: string } => {
    const { isUserUnauthenticated, location, redirectPath } = props;
    const pathname = location?.pathname || '';
    const returnTo = `${pathname}${location?.search || ''}`;

    if (!isUserUnauthenticated
        || !pathname.startsWith('/')
        || pathname === redirectPath) {
        return { pathname: redirectPath };
    }

    return {
        pathname: redirectPath,
        search: `?returnTo=${encodeURIComponent(returnTo)}`,
    };
};

const mapStateToProps = (state: any) => ({
    // Mirrors the condition each app's Login uses to decide whether to render the form at
    // all — if Login would immediately forward this visitor, preserving a destination for
    // them is what creates the loop.
    isUserUnauthenticated: !state.user
        || !state.user.isAuthenticated
        || !state.user.details?.accessLevels?.length,
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
                to={getRedirectTo(props)}
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
