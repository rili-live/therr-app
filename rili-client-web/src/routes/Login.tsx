import * as React from 'react';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import { RouteComponentProps, withRouter } from 'react-router-dom';
import { IUserState } from 'types/user';
import translator from '../services/translator';
import LoginForm from '../components/LoginForm';
import UsersActions from '../redux/actions/UsersActions';

export const shouldRenderLoginForm = (props: ILoginProps) => !props.user
    || !props.user.isAuthenticated
    || !props.user.details.accessLevels
    || !props.user.details.accessLevels.length;

interface ILoginRouterProps {
    history: any;
    location: any;
}

interface ILoginDispatchProps {
    login: Function;
}

interface IStoreProps extends ILoginDispatchProps {
    user: IUserState;
}

// Regular component props
export interface ILoginProps extends RouteComponentProps<ILoginRouterProps>, IStoreProps {
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
            nextProps.history.push('/user/profile');
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
        document.title = `Rili | ${this.translate('pages.login.pageTitle')}`;
    }

    private translate: Function;

    login = (credentials: any) => this.props.login(credentials)

    public render(): JSX.Element | null {
        const { location } = this.props;
        const alertSuccessMessage = location.state && (location.state as any).successMessage;

        return (
            <div id="page_login" className="flex-box">
                <LoginForm login={this.login} alert={alertSuccessMessage}/>
            </div>
        );
    }
}

export default withRouter(connect(mapStateToProps, mapDispatchToProps)(LoginComponent));
