import * as React from 'react';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import { RouteComponentProps, withRouter } from 'react-router-dom';
import translator from '../services/translator';
import SocketActions from 'actions/socket';
import LoginForm from '../components/LoginForm';

interface ILoginRouterProps {
    history: any;
    location: any;
}

interface ILoginDispatchProps {
    login: Function;
}

interface IStoreProps extends ILoginDispatchProps {
}

// Regular component props
interface ILoginProps extends RouteComponentProps<ILoginRouterProps>, IStoreProps {
}

interface ILoginState {
    inputs: any;
}

const mapStateToProps = (state: any) => {
    return {
    };
};

const mapDispatchToProps = (dispatch: any) => {
    return bindActionCreators({
        login: SocketActions.login,
    }, dispatch);
};

/**
 * Login
 */
export class LoginComponent extends React.Component<ILoginProps, ILoginState> {
    private translate: Function;

    constructor(props: ILoginProps) {
        super(props);

        this.state = {
            inputs: {},
        };

        this.translate = (key: string, params: any) => translator('en-us', key, params);
    }

    componentDidMount() {
        document.title = 'Rili | Login';
    }

    login = (credentials: any) => {
        this.props.login(credentials).then(() => {
            this.props.history.push('/join-room');
        }).catch((error: any) => {
            // console.log('LOGIN_ERROR: ', error);
        });
    }

    public render(): JSX.Element | null {
        const { location } = this.props;

        return (
            <>
                <div className="flex-box">
                    <LoginForm login={this.login} alert={location.state && location.state.successMessage}/>
                </div>
            </>
        );
    }
}

export default withRouter(connect(mapStateToProps, mapDispatchToProps)(LoginComponent));