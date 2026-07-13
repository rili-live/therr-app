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
        };
    }

    componentDidMount() {
        document.title = `Therr | ${this.props.translate('pages.register.pageTitle')}`;

        const { token } = this.props.routeParams;
        UsersService.getInviteByToken(token)
            .then((response: any) => {
                const invite = response?.data || {};
                this.setState({
                    isLoading: false,
                    prefillEmail: invite.email || '',
                    inviterName: invite.inviterName || '',
                });
            })
            .catch(() => {
                // Unknown/expired token — still let the user register normally.
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
            errorMessage, isLoading, prefillEmail, inviterName,
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
                    errorMessage
                    && <div className="alert-error text-center">{errorMessage}</div>
                }
            </>
        );
    }
}

export default withNavigation(withTranslation(connect(mapStateToProps, mapDispatchToProps)(InviteLinkLandingComponent)));
