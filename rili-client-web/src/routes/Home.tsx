import * as React from 'react';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import { RouteComponentProps, withRouter } from 'react-router-dom';
import { IUserState } from 'rili-react/types';
import translator from '../services/translator';
import LoginForm from '../components/LoginForm';
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
        document.title = `Rili | ${this.translate('pages.home.pageTitle')}`;
    }

    private translate: Function;

    login = (credentials: any) => this.props.login(credentials)

    public render(): JSX.Element | null {
        return (
            <div id="page_home" className="flex-box">
                <LoginForm login={this.login} title={this.translate('pages.home.pageTitle')} />
            </div>
        );
    }
}

export default withRouter(connect(mapStateToProps, mapDispatchToProps)(HomeComponent));
