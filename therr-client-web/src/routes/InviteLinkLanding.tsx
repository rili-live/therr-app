import * as React from 'react';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import { NavigateFunction, Location } from 'react-router-dom';
import { IUserState } from 'therr-react/types';
import { UsersService } from 'therr-react/services';
import RegisterForm from '../components/forms/RegisterForm';
import UsersActions from '../redux/actions/UsersActions';
import { getRouteAfterLogin, shouldRenderLoginForm } from './Login';
import withNavigation from '../wrappers/withNavigation';
import withTranslation from '../wrappers/withTranslation';
import getBrandAppStore, { IBrandAppStore } from '../utilities/brandAppStores';

interface IInviteLinkRouterProps {
    navigation: {
        navigate: NavigateFunction;
    };
    routeParams: {
        token: string;
    };
}

interface IInviteLinkDispatchProps {
    login: Function;
    register: Function;
    location: Location;
}

interface IStoreProps extends IInviteLinkDispatchProps {
    user: IUserState;
}

interface IInviteLinkProps extends IInviteLinkRouterProps, IStoreProps {
    translate: (key: string, params?: any) => string;
}

interface IInviteLinkState {
    errorMessage: string;
    isLoading: boolean;
    prefillEmail: string;
    inviterName: string;
    /** Store links for the app this invite was minted in — not necessarily this one. */
    appStore: IBrandAppStore;
    isMobile: boolean;
}

const mapStateToProps = (state: any) => ({
    user: state.user,
});

const mapDispatchToProps = (dispatch: any) => bindActionCreators({
    login: UsersActions.login,
    register: UsersActions.register,
}, dispatch);

/**
 * Magic invite-link landing (/invite/link/:token). Resolves the invite token to
 * pre-fill the invitee's known email and show who invited them, then renders the
 * standard RegisterForm with the token attached so registration trusts the
 * invited channel and auto-connects the two users.
 */
export class InviteLinkLandingComponent extends React.Component<IInviteLinkProps, IInviteLinkState> {
    static getDerivedStateFromProps(nextProps: IInviteLinkProps) {
        if (!shouldRenderLoginForm(nextProps as any)) {
            const destination = getRouteAfterLogin(nextProps.user);
            setTimeout(() => nextProps.navigation.navigate(destination));
            return null;
        }
        return {};
    }

    constructor(props: IInviteLinkProps) {
        super(props);

        this.state = {
            errorMessage: '',
            isLoading: true,
            prefillEmail: '',
            inviterName: '',
            appStore: getBrandAppStore(),
            isMobile: false,
        };
    }

    componentDidMount() {
        document.title = `Therr | ${this.props.translate('pages.register.pageTitle')}`;

        if (typeof window !== 'undefined' && window.navigator) {
            const ua = window.navigator.userAgent.toLowerCase();
            const isMobile = ua.indexOf('android') > -1 || ua.indexOf('iphone') > -1 || ua.indexOf('ipad') > -1;
            this.setState({ isMobile });
        }

        const { token } = this.props.routeParams;
        UsersService.getInviteByToken(token)
            .then((response: any) => {
                const invite = response?.data || {};
                this.setState({
                    isLoading: false,
                    prefillEmail: invite.email || '',
                    inviterName: invite.inviterName || '',
                    // The invite carries the brand it was minted in. Registering on the web
                    // works for either, but the install link has to match or the invitee
                    // ends up in an app that cannot see the invite.
                    appStore: getBrandAppStore(invite.brandVariation),
                });
            })
            .catch(() => {
                // Unknown/expired token — still let the user register normally, and leave
                // the store links on the Therr default rather than guessing.
                this.setState({ isLoading: false });
            });
    }

    register = (credentials: any) => {
        const { token } = this.props.routeParams;
        this.props.register({
            ...credentials,
            inviteToken: token,
        }).then(() => {
            this.props.navigation.navigate('/login', {
                state: {
                    successMessage: this.props.translate('pages.register.registerSuccess'),
                },
            });
        }).catch((error: any) => {
            if (error.statusCode === 400) {
                this.setState({ errorMessage: error.message });
            } else {
                this.setState({ errorMessage: this.props.translate('pages.register.registerError') });
            }
        });
    };

    public render(): JSX.Element | null {
        const {
            errorMessage, isLoading, prefillEmail, inviterName, appStore, isMobile,
        } = this.state;
        const { token } = this.props.routeParams;

        if (isLoading) {
            return null;
        }

        return (
            <>
                <div id="page_invite_link_landing" className="flex-box space-evenly center row wrap-reverse">
                    <RegisterForm
                        register={this.register}
                        onGoogleRegister={undefined}
                        title={this.props.translate('pages.register.pageTitle')}
                        prefillEmail={prefillEmail}
                        inviteToken={token}
                        inviterName={inviterName}
                    />
                </div>
                {
                    isMobile
                    && (
                        <div className="flex-box column center" style={{ gap: '1rem', marginTop: '1rem' }}>
                            <p className="text-center">
                                {this.props.translate('pages.inviteLinkLanding.appStoreText', { appName: appStore.appName })}
                            </p>
                            <div className="flex-box row space-evenly" style={{ gap: '1rem' }}>
                                {
                                    appStore.appStoreUrl
                                    && (
                                        <a href={appStore.appStoreUrl} target="_blank" rel="noreferrer">
                                            <img
                                                src="/assets/images/apple-store-download-button.svg"
                                                alt={`Download ${appStore.appName} on the App Store`}
                                                className="max-100"
                                                width="150"
                                                height="50"
                                                loading="lazy"
                                            />
                                        </a>
                                    )
                                }
                                <a href={appStore.playStoreUrl} target="_blank" rel="noreferrer">
                                    <img
                                        src="/assets/images/play-store-download-button.svg"
                                        alt={`Download ${appStore.appName} on Google Play`}
                                        className="max-100"
                                        width="150"
                                        height="50"
                                        loading="lazy"
                                    />
                                </a>
                            </div>
                        </div>
                    )
                }
                {
                    errorMessage
                    && <div className="alert-error text-center">{errorMessage}</div>
                }
            </>
        );
    }
}

export default withNavigation(withTranslation(connect(mapStateToProps, mapDispatchToProps)(InviteLinkLandingComponent)));
