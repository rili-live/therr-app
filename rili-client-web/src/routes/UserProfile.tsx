import * as React from 'react';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import { RouteComponentProps, withRouter, Link } from 'react-router-dom';
import translator from '../services/translator';
import SocketActions from 'actions/socket';
import { IUserState } from 'types/user';

interface IUserProfileRouterProps {
}

interface IUserProfileDispatchProps {
    login: Function;
}

interface IStoreProps extends IUserProfileDispatchProps {
    user: IUserState;
}

// Regular component props
interface IUserProfileProps extends RouteComponentProps<IUserProfileRouterProps>, IStoreProps {
}

interface IUserProfileState {
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
 * UserProfile
 */
export class UserProfileComponent extends React.Component<IUserProfileProps, IUserProfileState> {
    private translate: Function;

    constructor(props: IUserProfileProps) {
        super(props);

        this.translate = (key: string, params: any) => translator('en-us', key, params);
    }

    componentDidMount() {
        document.title = 'Rili | User Profile';
    }

    login = (credentials: any) => {
        this.props.login(credentials).then(() => {
            this.props.history.push('/join-room');
        }).catch((error: any) => {
            // console.log('HOME_LOGIN_ERROR: ', error);
        });
    }

    public render(): JSX.Element | null {
        const { user } = this.props;

        return (
            <div className="flex-box">
                <h1>User Profile</h1>
                <div>
                    <h3><b>Firstname:</b> {user.details.firstName}</h3>
                    <h3><b>Lastname:</b> {user.details.lastName}</h3>
                    <h3><b>Username:</b> {user.details.userName}</h3>
                    <h3><b>E-mail:</b> {user.details.email}</h3>
                    <h3><b>Phone:</b> {user.details.phoneNumber}</h3>

                    <Link to="/join-room">Join a room</Link>
                </div>
            </div>
        );
    }
}

export default withRouter(connect(mapStateToProps, mapDispatchToProps)(UserProfileComponent));