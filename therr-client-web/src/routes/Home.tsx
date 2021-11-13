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
            <div id="page_home" className="flex-box space-evenly row wrap-reverse">
                <div className="login-container">
                    <h1 className="text-center">
                        {this.translate('pages.home.welcome')}
                    </h1>
                    <p className="text-center info-text">{this.translate('pages.home.info')} <a href="https://apps.apple.com/us/app/therr/id1569988763#?platform=iphone" target="_blank" rel="noreferrer"><em className="bold">{this.translate('pages.home.apple')}</em></a> {this.translate('pages.home.or')} <a href="https://play.google.com/store/apps/details?id=app.therrmobile" target="_blank" rel="noreferrer"><em className="bold">{this.translate('pages.home.android')}</em></a> {this.translate('pages.home.devices')}.</p>
                    <p className="text-center info-text">{this.translate('pages.home.info2')}</p>
                    <p className="text-center info-text"><em className="bold font-size-20">{this.translate('pages.home.freelancers')}</em> {this.translate('pages.home.info3')}</p>
                    <p className="text-center info-text"><em className="bold font-size-20">{this.translate('pages.home.eventOrganizers')}</em> {this.translate('pages.home.info4')}</p>
                </div>
                <LoginForm login={this.login} />
            </div>
        );
    }
}

export default withRouter(connect(mapStateToProps, mapDispatchToProps)(HomeComponent));
