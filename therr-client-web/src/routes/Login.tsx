import * as React from 'react';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import LogRocket from 'logrocket';
import qs from 'qs';
import { IUserState } from 'therr-react/types';
import { AccessLevels } from 'therr-js-utilities/constants';
import { Location, NavigateFunction } from 'react-router-dom';
import LoginForm from '../components/forms/LoginForm';
import UsersActions from '../redux/actions/UsersActions';
import withNavigation from '../wrappers/withNavigation';
import withTranslation from '../wrappers/withTranslation';

export const shouldRenderLoginForm = (props: ILoginProps) => !props.user
    || !props.user.isAuthenticated
    || !props.user.details.accessLevels
    || !props.user.details.accessLevels.length;

export const routeAfterLogin = '/explore';

/**
 * Extracts and validates the returnTo query parameter from a location search string.
 * Only allows relative paths starting with '/' to prevent open redirect vulnerabilities.
 */
export const getReturnTo = (locationSearch?: string): string | undefined => {
    if (!locationSearch) return undefined;
    const searchParams = qs.parse(locationSearch, { ignoreQueryPrefix: true });
    const returnTo = searchParams?.returnTo as string;
    if (returnTo && returnTo.startsWith('/') && !returnTo.startsWith('//')) {
        return returnTo;
    }
    return undefined;
};

export const getRouteAfterLogin = (user: IUserState, returnTo?: string) => {
    const accessLevels = user?.details?.accessLevels || [];
    if (accessLevels.includes(AccessLevels.EMAIL_VERIFIED_MISSING_PROPERTIES)
        && !accessLevels.includes(AccessLevels.EMAIL_VERIFIED)) {
        const returnToParam = returnTo ? `?returnTo=${encodeURIComponent(returnTo)}` : '';
        return `/create-profile${returnToParam}`;
    }
    return returnTo || routeAfterLogin;
};

interface ILoginRouterProps {
    location: Location;
    navigation: {
        navigate: NavigateFunction;
    }
}

interface ILoginDispatchProps {
    login: Function;
}

interface IStoreProps extends ILoginDispatchProps {
    user: IUserState;
}

// Regular component props
export interface ILoginProps extends ILoginRouterProps, IStoreProps {
    translate: (key: string, params?: any) => string;
}

interface ILoginState {
    inputs: any;
}

const mapStateToProps = (state: any) => ({
    user: state.user,
});

const mapDispatchToProps = (dispatch: any) => bindActionCreators({
    login: UsersActions.login,
}, dispatch);

/**
 * Login
 */
export class LoginComponent extends React.Component<ILoginProps, ILoginState> {
    static getDerivedStateFromProps(nextProps: ILoginProps) {
        if (!shouldRenderLoginForm(nextProps)) {
            LogRocket.identify(nextProps.user.details.id, {
                name: `${nextProps.user.details.firstName} ${nextProps.user.details.lastName}`,
                email: nextProps.user.details.email,
            });
            const returnTo = getReturnTo(nextProps.location?.search);
            const destination = getRouteAfterLogin(nextProps.user, returnTo);
            setTimeout(() => nextProps.navigation.navigate(destination));
            return null;
        }
        return {};
    }

    constructor(props: ILoginProps) {
        super(props);

        this.state = {
            inputs: {},
        };
    }

    componentDidMount() { // eslint-disable-line class-methods-use-this
        document.title = `Therr | ${this.props.translate('pages.login.pageTitle')}`;
    }

    login = (credentials: any) => this.props.login(credentials);

    loginSSO = (ssoData: any) => {
        console.log('[LoginSSO] Dispatching login with SSO data', { // eslint-disable-line no-console
            isSSO: ssoData.isSSO,
            ssoProvider: ssoData.ssoProvider,
            userEmail: ssoData.userEmail,
            hasIdToken: !!ssoData.idToken,
        });
        return this.props.login(ssoData, { google: ssoData.idToken })
            .then((result: any) => {
                console.log('[LoginSSO] Login succeeded', result); // eslint-disable-line no-console
                return result;
            })
            .catch((error: any) => {
                console.error('[LoginSSO] Login failed', { // eslint-disable-line no-console
                    statusCode: error?.statusCode,
                    message: error?.message,
                    error,
                });
                throw error;
            });
    };

    public render(): JSX.Element | null {
        const { location } = this.props;
        const alertMessage = (location.state as any)?.successMessage || (location.state as any)?.errorMessage;
        const alertVariation = (location.state as any)?.successMessage ? 'success' : 'error';

        return (
            <div id="page_login" className="flex-box center space-evenly column">
                <LoginForm className="self-center" login={this.login} onGoogleLogin={this.loginSSO} alert={alertMessage} alertVariation={alertVariation} />
                <div className="store-image-links margin-top-lg">
                    <a href="https://apps.apple.com/us/app/therr/id1569988763?platform=iphone" target="_blank" rel="noreferrer">
                        <img
                            aria-label="apple store link"
                            className="max-100"
                            src="/assets/images/apple-store-download-button.svg"
                            alt="Download Therr on the App Store"
                            width="150"
                            height="50"
                            loading="lazy"
                        />
                    </a>
                    <a href="https://play.google.com/store/apps/details?id=app.therrmobile" target="_blank" rel="noreferrer">
                        <img
                            aria-label="play store link"
                            className="max-100"
                            src="/assets/images/play-store-download-button.svg"
                            alt="Download Therr on Google Play"
                            width="150"
                            height="50"
                            loading="lazy"
                        />
                    </a>
                </div>
            </div>
        );
    }
}

export default withNavigation(withTranslation(connect(mapStateToProps, mapDispatchToProps)(LoginComponent)));
