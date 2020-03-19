import * as React from 'react';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import { RouteComponentProps, withRouter, Link } from 'react-router-dom';
import SocketActions from 'actions/socket';
import { IUserState } from 'types/user';
import translator from '../services/translator';

// interface IUserProfileRouterProps {
// }

interface IUserProfileDispatchProps {
}

interface IStoreProps extends IUserProfileDispatchProps {
    user: IUserState;
}

// Regular component props
interface IUserProfileProps extends RouteComponentProps<{}>, IStoreProps {
}

interface IUserProfileState {
    inputs: any;
}

const mapStateToProps = (state: any) => ({
    user: state.user,
});

const mapDispatchToProps = (dispatch: any) => bindActionCreators({
}, dispatch);

/**
 * UserProfile
 */
export class UserProfileComponent extends React.Component<IUserProfileProps, IUserProfileState> {
    private translate: Function; // eslint-disable-line react/sort-comp

    constructor(props: IUserProfileProps) {
        super(props);

        this.translate = (key: string, params: any) => translator('en-us', key, params);
    }

    componentDidMount() { // eslint-disable-line class-methods-use-this
        document.title = 'Rili | User Profile';
    }

    public render(): JSX.Element | null {
        const { user } = this.props;

        if (!user.details) {
            return null;
        }

        return (
            <div id="page_user_profile" className="flex-box">
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
