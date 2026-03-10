/* eslint-disable max-len, react/jsx-no-target-blank */
import * as React from 'react';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import { NavigateFunction } from 'react-router-dom';
import { IUserState } from 'therr-react/types';
import LoginForm from '../components/forms/LoginForm';
import { shouldRenderLoginForm, ILoginProps, routeAfterLogin } from './Login';
import UsersActions from '../redux/actions/UsersActions';
import withNavigation from '../wrappers/withNavigation';
import withTranslation from '../wrappers/withTranslation';

interface IHomeRouterProps {
    navigation: {
        navigate: NavigateFunction;
    }
}

interface IHomeDispatchProps {
    login: Function;
}

interface IStoreProps extends IHomeDispatchProps {
    user: IUserState;
}

// Regular component props
interface IHomeProps extends IHomeRouterProps, IStoreProps {
    translate: (key: string, params?: any) => string;
}

interface IHomeState {
    inputs: any;
}

const mapStateToProps = (state: any) => ({
    user: state.user,
});

const mapDispatchToProps = (dispatch: any) => bindActionCreators({
    login: UsersActions.login,
}, dispatch);

/**
 * Home
 */
export class HomeComponent extends React.Component<IHomeProps, IHomeState> {
    static getDerivedStateFromProps(nextProps: IHomeProps) {
        if (!shouldRenderLoginForm(nextProps as ILoginProps)) {
            // TODO: This doesn't seem to work with react-router-dom v6 after a newly created user tries to login
            // Causes a flicker / Need to investigate further
            setTimeout(() => nextProps.navigation.navigate(routeAfterLogin));
            return null;
        }
        return {};
    }

    constructor(props: IHomeProps) {
        super(props);

        this.state = {
            inputs: {},
        };
    }

    componentDidMount() { // eslint-disable-line class-methods-use-this
        document.title = `Therr | ${this.props.translate('pages.home.pageTitle')}`;
    }

    login = (credentials: any) => this.props.login(credentials);

    public render(): JSX.Element | null {
        return (
            <div id="page_home" className="flex-box space-evenly center row wrap-reverse">
                <div className="login-container info-container">
                    <div className="flex fill max-wide-40">
                        <div className="flex-box fill">
                            <img src="/assets/images/on-the-map.svg" alt="Therr users on the map" width="400" height="300" />
                        </div>
                        <h2 className="text-title-medium no-bot-margin fill">
                            {this.props.translate('pages.home.welcome')}
                        </h2>
                        <p className="info-text fill">{this.props.translate('pages.home.info')}</p>
                        <p className="info-text fill margin-top-lg margin-bot-lg">{this.props.translate('pages.home.info2')}</p>
                        <p className="info-text fill margin-top-lg margin-bot-lg">{this.props.translate('pages.home.info3')}</p>
                        <div className="store-image-links margin-top-lg">
                            <a href="https://apps.apple.com/us/app/therr/id1569988763?platform=iphone" target="_blank" rel="noreferrer">
                                <img aria-label="apple store link" className="max-100" src="/assets/images/apple-store-download-button.svg" alt="Download Therr on the App Store" width="150" height="50" loading="lazy" />
                            </a>
                            <a href="https://play.google.com/store/apps/details?id=app.therrmobile" target="_blank" rel="noreferrer">
                                <img aria-label="play store link" className="max-100" src="/assets/images/play-store-download-button.svg" alt="Download Therr on Google Play" width="150" height="50" loading="lazy" />
                            </a>
                        </div>
                        <div className="text-center" style={{ padding: '1.5rem 0 0 1rem' }}>
                            <a href="https://www.therr.app/privacy-policy.html" target="_blank" className="link-plain-white">{this.props.translate('components.loginForm.buttons.privacyPolicy')}</a> | <a href="https://www.therr.app/terms-and-conditions.html" target="_blank" className="link-plain-white">{this.props.translate('components.loginForm.buttons.toc')}</a>
                        </div>
                    </div>
                </div>
                <LoginForm login={this.login} />
            </div>
        );
    }
}

export default withNavigation(withTranslation(connect(mapStateToProps, mapDispatchToProps)(HomeComponent)));
