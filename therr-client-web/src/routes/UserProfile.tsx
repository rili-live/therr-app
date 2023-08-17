import * as React from 'react';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import { NavigateFunction } from 'react-router-dom';
import { UserConnectionsActions } from 'therr-react/redux/actions';
import { IUserState, IUserConnectionsState } from 'therr-react/types';
import CreateConnectionForm from '../components/forms/CreateConnectionForm';
import translator from '../services/translator';
import withNavigation from '../wrappers/withNavigation';

interface IUserProfileRouterProps {
    navigation: {
        navigate: NavigateFunction;
    }
}

interface IUserProfileDispatchProps {
    createUserConnection: Function;
    searchUserConnections: Function;
}

interface IStoreProps extends IUserProfileDispatchProps {
    user: IUserState;
    userConnections: IUserConnectionsState;
}

// Regular component props
interface IUserProfileProps extends IUserProfileRouterProps, IStoreProps {
    onInitMessaging?: Function;
}

interface IUserProfileState {}

const mapStateToProps = (state: any) => ({
    user: state.user,
    userConnections: state.userConnections,
});

const mapDispatchToProps = (dispatch: any) => bindActionCreators({
    createUserConnection: UserConnectionsActions.create,
    searchUserConnections: UserConnectionsActions.search,
}, dispatch);

/**
 * UserProfile
 */
export class UserProfileComponent extends React.Component<IUserProfileProps, IUserProfileState> {
    private translate: Function;

    constructor(props: IUserProfileProps) {
        super(props);

        this.state = {};

        this.translate = (key: string, params: any) => translator('en-us', key, params);
    }

    componentDidMount() {
        const {
            user,
            userConnections,
        } = this.props;
        document.title = `Therr | ${this.translate('pages.userProfile.pageTitle')} | ${user.details.userName}`;
        if (!userConnections.connections.length) {
            this.props.searchUserConnections({
                filterBy: 'acceptingUserId',
                query: user.details.id,
                itemsPerPage: 50,
                pageNumber: 1,
                orderBy: 'interactionCount',
                order: 'desc',
                shouldCheckReverse: true,
            }, user.details.id).catch((err) => console.log(err));
        }
    }

    getConnectionDetails = (connection) => {
        const { user } = this.props;

        return connection.users.find((u) => u.id !== user.details.id);
    };

    handleInitMessaging = (e, connection) => {
        const { onInitMessaging } = this.props;
        return onInitMessaging && onInitMessaging(e, this.getConnectionDetails(connection), 'user-profile');
    };

    onCreateForumClick = () => {
        this.props.navigation.navigate('/create-forum');
    };

    public render(): JSX.Element | null {
        const { createUserConnection, user, userConnections } = this.props;

        if (!user.details) {
            return null;
        }

        return (
            <div id="page_user_profile" className="flex-box column">
                <div className="header-profile-picture">
                    <h1 className="fill text-left">{user.details.userName}</h1>
                    <div className="user-profile-icon">
                        <img
                            src={`https://robohash.org/${user.details.id}?size=100x100`}
                            alt="Profile Picture"
                        />
                    </div>
                </div>
                <div className="flex-box account-sections">
                    <div id="account_details" className="account-section">
                        <h2 className="desktop-only block">{this.translate('pages.userProfile.h2.accountDetails')}</h2>
                        <div className="account-section-content">
                            <h4><label>{this.translate('pages.userProfile.labels.firstName')}:</label> {user.details.firstName}</h4>
                            <h4><label>{this.translate('pages.userProfile.labels.lastName')}:</label> {user.details.lastName}</h4>
                            <h4><label>{this.translate('pages.userProfile.labels.userName')}:</label> {user.details.userName}</h4>
                            <h4><label>{this.translate('pages.userProfile.labels.email')}:</label> {user.details.email}</h4>
                            <h4><label>{this.translate('pages.userProfile.labels.phone')}:</label> {user.details.phoneNumber}</h4>
                        </div>
                    </div>
                    <div id="your_connections" className="account-section">
                        <h2>{this.translate('pages.userProfile.h2.connections')}</h2>
                        <div id="user-connections-container" className="user-connections-container account-section-content">
                            {
                                userConnections.connections.length
                                    ? userConnections.connections.slice(0, 10).map((connection: any) => {
                                        const connectionDetails = this.getConnectionDetails(connection);

                                        return (
                                            <div className="user-connection-icon" key={connectionDetails.id}>
                                                {
                                                    connection.users
                                                    && <span className="name-tag">{connectionDetails.firstName}</span>
                                                }
                                                <img
                                                    src={`https://robohash.org/${connectionDetails.id}?size=100x100`}
                                                    alt="User Connection"
                                                    onClick={(e) => this.handleInitMessaging(e, connection)}
                                                />
                                            </div>
                                        );
                                    })
                                    : <span><i>{this.translate('pages.userProfile.requestRecommendation')}</i></span>
                            }
                        </div>
                    </div>
                    <div id="add_connections" className="account-section">
                        <h2>{this.translate('pages.userProfile.h2.addConnection')}</h2>
                        <div className="account-content">
                            <CreateConnectionForm
                                createUserConnection={createUserConnection}
                                user={user}
                            />
                        </div>
                    </div>
                </div>
                <div className="fill text-right padding-sm">
                    <button type="button" className="primary text-white" onClick={this.onCreateForumClick}>
                        {this.translate('pages.userProfile.buttons.createAForum')}
                    </button>
                </div>
            </div>
        );
    }
}

export default withNavigation(connect(mapStateToProps, mapDispatchToProps)(UserProfileComponent));
