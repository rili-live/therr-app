import * as React from 'react';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import LogRocket from 'logrocket';
import { IUserState } from 'therr-react/types';
import { Location, NavigateFunction } from 'react-router-dom';
import translator from '../services/translator';
import LoginForm from '../components/forms/LoginForm';
import UsersActions from '../redux/actions/UsersActions';
import withNavigation from '../wrappers/withNavigation';

export const shouldRenderLoginForm = (props: ILoginProps) => !props.user
    || !props.user.isAuthenticated
    || !props.user.details.accessLevels
    || !props.user.details.accessLevels.length;

export const routeAfterLogin = '/user/go-mobile';

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
    private translate: Function;

    static getDerivedStateFromProps(nextProps: ILoginProps) {
        // TODO: Choose route based on accessLevels
        if (!shouldRenderLoginForm(nextProps)) {
            LogRocket.identify(nextProps.user.details.id, {
                name: `${nextProps.user.details.firstName} ${nextProps.user.details.lastName}`,
                email: nextProps.user.details.email,
                // Add your own custom user variables below:
            });
            // TODO: This doesn't seem to work with react-router-dom v6 after a newly created user tries to login
            // Causes a flicker / Need to investigate further
            setTimeout(() => nextProps.navigation.navigate(routeAfterLogin));
            return null;
        }
        return {};
    }

    constructor(props: ILoginProps) {
        super(props);

        this.state = {
            inputs: {},
        };

        this.translate = (key: string, params: any) => translator('en-us', key, params);
    }

    componentDidMount() { // eslint-disable-line class-methods-use-this
        document.title = `Therr | ${this.translate('pages.login.pageTitle')}`;
    }

    login = (credentials: any) => this.props.login(credentials);

    public render(): JSX.Element | null {
        const { location } = this.props;
        const alertMessage = (location.state as any)?.successMessage || (location.state as any)?.errorMessage;
        const alertVariation = (location.state as any)?.successMessage ? 'success' : 'error';

        return (
            <div id="page_login" className="flex-box center space-evenly column">
                <LoginForm className="self-center" login={this.login} alert={alertMessage} alertVariation={alertVariation} />
                <div className="store-image-links margin-top-lg">
                    <a href="https://apps.apple.com/us/app/therr/id1569988763?platform=iphone" target="_blank" rel="noreferrer">
                        <img
                            aria-label="apple store link"
                            className="max-100"
                            src="/assets/images/apple-store-download-button.svg"
                            alt="Download Therr on the App Store"
                        />
                    </a>
                    <a href="https://play.google.com/store/apps/details?id=app.therrmobile" target="_blank" rel="noreferrer">
                        <img
                            aria-label="play store link"
                            className="max-100"
                            src="/assets/images/play-store-download-button.svg"
                            alt="Download Therr on Google Play"
                        />
                    </a>
                </div>
            </div>
        );
    }
}

export default withNavigation(connect(mapStateToProps, mapDispatchToProps)(LoginComponent));
