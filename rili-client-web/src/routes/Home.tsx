import * as React from 'react';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import { RouteComponentProps, withRouter } from 'react-router-dom';
import SocketActions from 'actions/Socket';
import { IUserState } from 'types/user';
import translator from '../services/translator';
import LoginForm from '../components/LoginForm';
import { shouldRenderLoginForm, ILoginProps } from './Login';

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
    login: SocketActions.login,
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
        document.title = 'Rili | Home';
    }

    private translate: Function;

    login = (credentials: any) => this.props.login(credentials).then(() => {
        this.props.history.push('/join-room');
    })

    public render(): JSX.Element | null {
        return (
            <div id="page_chat_room" className="flex-box">
                <LoginForm login={this.login} title="Home" />
            </div>
        );
    }
}

export default withRouter(connect(mapStateToProps, mapDispatchToProps)(HomeComponent));
