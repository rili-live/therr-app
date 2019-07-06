import * as React from 'react';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import { RouteComponentProps, withRouter } from 'react-router-dom';
import translator from '../services/translator';
import SocketActions from 'actions/socket';
import LoginForm from '../components/LoginForm';
import { IUserState } from 'types/user';

const shouldRender = (props: IHomeProps) => {
    return !props.user.isAuthenticated;
};

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

const mapStateToProps = (state: any) => {
    return {
        user: state.user,
    };
};

const mapDispatchToProps = (dispatch: any) => {
    return bindActionCreators({
        login: SocketActions.login,
    }, dispatch);
};

/**
 * Home
 */
export class HomeComponent extends React.Component<IHomeProps, IHomeState> {
    private translate: Function;

    static getDerivedStateFromProps(nextProps: IHomeProps) {
        if (!shouldRender(nextProps)) {
            nextProps.history.push('/user/profile');
            return null;
        } else {
            return {};
        }
    }

    constructor(props: IHomeProps) {
        super(props);

        this.state = {
            inputs: {},
        };

        this.translate = (key: string, params: any) => translator('en-us', key, params);
    }

    componentDidMount() {
        document.title = 'Rili | Home';
    }

    login = (credentials: any) => {
        this.props.login(credentials).then(() => {
            this.props.history.push('/join-room');
        }).catch((error: any) => {
            // console.log('HOME_LOGIN_ERROR: ', error);
        });
    }

    public render(): JSX.Element | null {
        return (
            <div className="flex-box">
                <LoginForm login={this.login} title="Home" />
            </div>
        );
    }
}

export default withRouter(connect(mapStateToProps, mapDispatchToProps)(HomeComponent));