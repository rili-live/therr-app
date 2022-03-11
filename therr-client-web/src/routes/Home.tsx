/* eslint-disable max-len */
import * as React from 'react';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import { RouteComponentProps, withRouter } from 'react-router-dom';
import { IUserState } from 'therr-react/types';
import translator from '../services/translator';
import LoginForm from '../components/forms/LoginForm';
import { shouldRenderLoginForm, ILoginProps } from './Login';
import UsersActions from '../redux/actions/UsersActions';

interface IHomeRouterProps {
}

interface IHomeDispatchProps {
    login: Function;
}

interface IStoreProps extends IHomeDispatchProps {
    user: IUserState;
}

// Regular component props
interface IHomeProps extends RouteComponentProps<IHomeRouterProps>, IStoreProps {
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
    private translate: Function;

    static getDerivedStateFromProps(nextProps: IHomeProps) {
        if (!shouldRenderLoginForm(nextProps as ILoginProps)) {
            nextProps.history.push('/user/profile');
            return null;
        }
        return {};
    }

    constructor(props: IHomeProps) {
        super(props);

        this.state = {
            inputs: {},
        };

        this.translate = (key: string, params: any) => translator('en-us', key, params);
    }

    componentDidMount() { // eslint-disable-line class-methods-use-this
        document.title = `Therr | ${this.translate('pages.home.pageTitle')}`;
    }

    login = (credentials: any) => this.props.login(credentials);

    public render(): JSX.Element | null {
        return (
            <div id="page_home" className="flex-box space-evenly center row wrap-reverse">
                <div className="login-container info-container">
                    <div className="flex fill max-wide-40">
                        <div className="flex-box fill">
                            <img src="/assets/images/on-the-map.svg" alt="Therr users on the map" />
                        </div>
                        <h2 className="text-title-medium no-bot-margin fill">
                            {this.translate('pages.home.welcome')}
                        </h2>
                        <p className="info-text fill">{this.translate('pages.home.info')}</p>
                        <p className="info-text fill margin-top-lg margin-bot-lg">{this.translate('pages.home.info2')}</p>
                        <div className="flex-box row space-around margin-top-lg">
                            <a href="https://apps.apple.com/us/app/therr/id1569988763?platform=iphone" target="_blank" rel="noreferrer">
                                <img src="/assets/images/apple-store-download-button.svg" alt="Download Therr on the App Store" />
                            </a>
                            <a href="https://play.google.com/store/apps/details?id=app.therrmobile" target="_blank" rel="noreferrer">
                                <img src="/assets/images/play-store-download-button.svg" alt="Download Therr on Google Play" />
                            </a>
                        </div>
                    </div>
                </div>
                <LoginForm login={this.login} />
            </div>
        );
    }
}

export default withRouter(connect(mapStateToProps, mapDispatchToProps)(HomeComponent));
