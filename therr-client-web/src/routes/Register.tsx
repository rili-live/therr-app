import * as React from 'react';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import { Location, NavigateFunction } from 'react-router-dom';
import LogRocket from 'logrocket';
import qs from 'qs';
import { IUserState } from 'therr-react/types';
import RegisterForm from '../components/forms/RegisterForm';
import UsersActions from '../redux/actions/UsersActions';
import { routeAfterLogin, shouldRenderLoginForm } from './Login';
import withNavigation from '../wrappers/withNavigation';
import withTranslation from '../wrappers/withTranslation';

interface IRegisterRouterProps {
    navigation: {
        navigate: NavigateFunction;
    }
}

interface IRegisterDispatchProps {
    login: Function;
    register: Function;
    location: Location;
}

interface IStoreProps extends IRegisterDispatchProps {
    user: IUserState;
}

// Regular component props
interface IRegisterProps extends IRegisterRouterProps, IStoreProps {
    translate: (key: string, params?: any) => string;
}

interface IRegisterState {
    errorMessage: string;
    inputs: any;
    inviteCode: string;
}

const mapStateToProps = (state: any) => ({
    user: state.user,
});

const mapDispatchToProps = (dispatch: any) => bindActionCreators({
    login: UsersActions.login,
    register: UsersActions.register,
}, dispatch);

/**
 * Login
 */
export class RegisterComponent extends React.Component<IRegisterProps, IRegisterState> {
    static getDerivedStateFromProps(nextProps: IRegisterProps) {
        if (!shouldRenderLoginForm(nextProps as any)) {
            LogRocket.identify(nextProps.user.details.id, {
                name: `${nextProps.user.details.firstName} ${nextProps.user.details.lastName}`,
                email: nextProps.user.details.email,
            });
            setTimeout(() => nextProps.navigation.navigate(routeAfterLogin));
            return null;
        }
        return {};
    }

    constructor(props: IRegisterProps) {
        super(props);

        const searchParams = qs.parse(props.location?.search, { ignoreQueryPrefix: true });

        this.state = {
            errorMessage: '',
            inputs: {},
            inviteCode: searchParams?.['invite-code'] as string || '',
        };
    }

    componentDidMount() { // eslint-disable-line class-methods-use-this
        document.title = `Therr | ${this.props.translate('pages.register.pageTitle')}`;

        if (window?.location) {
            // eslint-disable-next-line no-inner-declarations
            function isIpadOS() {
                return navigator?.maxTouchPoints > 2 && /MacIntel/.test(navigator.platform);
            }
            if (navigator?.userAgent?.toLowerCase()?.indexOf('android') > -1 && (navigator as any).brave?.isBrave?.name !== 'isBrave') {
                // window.location.href = 'https://play.google.com/store/apps/details?id=app.therrmobile';
                window.location.href = 'market://details?id=app.therrmobile';
            } else if (navigator?.userAgent?.toLowerCase()?.indexOf('iphone') > -1 || isIpadOS()) {
                window.location.href = 'https://apps.apple.com/us/app/therr/id1569988763?platform=iphone';
            }
        }
    }

    registerSSO = (ssoData: any) => {
        console.log('[RegisterSSO] Dispatching login with SSO data', { // eslint-disable-line no-console
            isSSO: ssoData.isSSO,
            ssoProvider: ssoData.ssoProvider,
            userEmail: ssoData.userEmail,
            hasIdToken: !!ssoData.idToken,
        });
        this.props.login(ssoData, { google: ssoData.idToken })
            .then((result: any) => {
                console.log('[RegisterSSO] Login succeeded', result); // eslint-disable-line no-console
                return result;
            })
            .catch((error: any) => {
                console.error('[RegisterSSO] Login failed', { // eslint-disable-line no-console
                    statusCode: error?.statusCode,
                    message: error?.message,
                    error,
                });
                this.setState({
                    errorMessage: error?.message || this.props.translate('pages.register.registerError'),
                });
            });
    };

    register = (credentials: any) => {
        const { inviteCode } = this.state;
        this.props.register({
            ...credentials,
            inviteCode,
        }).then((response: any) => {
            this.props.navigation.navigate('/login', {
                state: {
                    successMessage: this.props.translate('pages.register.registerSuccess'),
                },
            });
        }).catch((error: any) => {
            if (error.statusCode === 400) {
                this.setState({
                    errorMessage: error.message,
                });
            } else {
                this.setState({
                    errorMessage: this.props.translate('pages.register.registerError'),
                });
            }
        });
    };

    public render(): JSX.Element | null {
        const { errorMessage, inviteCode } = this.state;

        return (
            <>
                <div id="page_register" className="flex-box space-evenly center row wrap-reverse">
                    <RegisterForm
                        register={this.register}
                        onGoogleRegister={this.registerSSO}
                        title={this.props.translate('pages.register.pageTitle')}
                        inviteCode={inviteCode}
                    />
                </div>
                {
                    errorMessage
                    && <div className="alert-error text-center">{errorMessage}</div>
                }
            </>
        );
    }
}

export default withNavigation(withTranslation(connect(mapStateToProps, mapDispatchToProps)(RegisterComponent)));
