import * as React from 'react';
import { connect } from 'react-redux';
import ButtonPrimary from 'rili-public-library/react-components/ButtonPrimary.js';
import InlineSvg from 'rili-public-library/react-components/InlineSvg.js';
import SvgButton from 'rili-public-library/react-components/SvgButton.js';
import { ISocketState } from 'types/socket';
import { IUserState } from 'types/user';
import { IUserConnectionsState } from 'types/userConnections';
import UsersActions from 'actions/Users';
import UserConnectionsActions from 'actions/UserConnections';
import { bindActionCreators } from 'redux';
import translator from '../../services/translator';

interface IMessagesMenuDispatchProps {
    logout: Function;
    searchUserConnections: Function;
}

interface IStoreProps extends IMessagesMenuDispatchProps {
    history: any;
    socket: ISocketState;
    user: IUserState;
    userConnections: IUserConnectionsState;
}

// Regular component props
interface IMessagesMenuProps extends IStoreProps {
    toggleNavMenu: Function;
}

interface IMessagesMenuState {
    activeTab: string;
}

const mapStateToProps = (state: any) => ({
    socket: state.socket,
    user: state.user,
    userConnections: state.userConnections,
});

const mapDispatchToProps = (dispatch: any) => bindActionCreators({
    logout: UsersActions.logout,
    searchUserConnections: UserConnectionsActions.search,
}, dispatch);

export class MessagesMenuComponent extends React.Component<IMessagesMenuProps, IMessagesMenuState> {
    constructor(props) {
        super(props);

        this.state = {
            activeTab: 'messages',
        };

        this.translate = (key: string, params: any) => translator('en-us', key, params);
    }

    componentDidMount() {
        const {
            user,
            userConnections,
        } = this.props;
        if (!userConnections.connections.length) {
            this.props.searchUserConnections({
                filterBy: 'acceptingUserId',
                query: user.details.id,
                itemsPerPage: 20,
                pageNumber: 1,
                orderBy: 'interactionCount',
                order: 'desc',
                shouldCheckReverse: true,
            });
        }
    }

    private translate: Function;

    handleTabSelect = (e, tabName) => {
        this.setState({
            activeTab: tabName,
        });
    }

    handleConnectionClick = (e, connectionDetails) => {
        console.log(connectionDetails);
    }

    navigate = (destination, params?: any) => (e) => {
        this.props.toggleNavMenu(e);

        switch (destination) {
            case 'create-forum':
                return this.props.history.push('/create-forum');
            case 'forums':
                return this.props.history.push(`/forums/${params.roomKey}`);
            default:
        }
    }

    renderMessagesContent = () => {
        const { userConnections, user } = this.props;

        return (
            <>
                <h2>{this.translate('components.messagesMenu.h2.messaging')}</h2>
                <div className="messages-menu"></div>
                {
                    userConnections && userConnections.connections.length > 0
                    && <div className="realtime-connections-list">
                        {
                            userConnections.connections.map((connection) => {
                                const connectionDetails = connection.users.find((u) => u.id !== user.details.id);
                                return (
                                    <ButtonPrimary
                                        id="nav_menu_connection_link"
                                        key={connection.id}
                                        className="connection-link-item right-icon active"
                                        name={connection.id}
                                        onClick={(e) => this.handleConnectionClick(e, connectionDetails)}
                                        buttonType="primary">
                                        {`${connectionDetails.firstName} ${connectionDetails.lastName}`}
                                    </ButtonPrimary>
                                );
                            })
                        }
                    </div>
                }
            </>
        );
    }

    renderForumsContent = () => {
        const { socket } = this.props;

        return (
            <>
                <h2>{this.translate('components.messagesMenu.h2.forums')}</h2>
                <div className="forums-menu">
                    <ButtonPrimary
                        id="nav_menu_join_forum"
                        className="menu-item left-icon"
                        name="Join Forum"
                        onClick={this.navigate('create-forum')} buttonType="primary"
                    >
                        <InlineSvg name="add-circle" />
                        {this.translate('components.messagesMenu.buttons.createForum')}
                    </ButtonPrimary>
                    {
                        socket && socket.forums.length > 0
                        && <div className="realtime-forums-list">
                            {
                                socket.forums.map((forum) => (
                                    <ButtonPrimary
                                        id="nav_menu_forum_link"
                                        key={forum.roomKey}
                                        className="forum-link-item right-icon active"
                                        name={forum.roomKey}
                                        onClick={this.navigate('forums', { roomKey: forum.roomKey })}
                                        buttonType="primary">
                                        {forum.roomKey}
                                        <InlineSvg name="door" />
                                    </ButtonPrimary>
                                ))
                            }
                        </div>
                    }
                </div>
            </>
        );
    }

    renderPeopleContent = () => (
        <>
            <h2>{this.translate('components.messagesMenu.h2.riliConnect')}</h2>
        </>
    )

    renderLocationContent = () => (
        <>
            <h2>{this.translate('components.messagesMenu.h2.locationMap')}</h2>
        </>
    )

    render() {
        const { activeTab } = this.state;
        const { socket, toggleNavMenu } = this.props;

        return (
            <>
                <div className="nav-menu-header">
                    <SvgButton
                        id="nav_menu_messages_button"
                        name="messages"
                        className={`menu-tab-button ${activeTab === 'messages' ? 'active' : ''}`}
                        iconClassName="tab-icon"
                        onClick={(e) => this.handleTabSelect(e, 'messages')}
                        buttonType="primary"
                    />
                    <SvgButton
                        id="nav_menu_forums_button"
                        name="forum"
                        className={`menu-tab-button ${activeTab === 'forums' ? 'active' : ''}`}
                        iconClassName="tab-icon"
                        onClick={(e) => this.handleTabSelect(e, 'forums')}
                        buttonType="primary"
                    />
                    <SvgButton
                        id="nav_menu_people"
                        name="people"
                        className={`menu-tab-button ${activeTab === 'people' ? 'active' : ''}`}
                        iconClassName="tab-icon"
                        onClick={(e) => this.handleTabSelect(e, 'people')}
                        buttonType="primary"
                    />
                    <SvgButton
                        id="nav_menu_location"
                        name="location"
                        className={`menu-tab-button ${activeTab === 'location' ? 'active' : ''}`}
                        iconClassName="tab-icon"
                        onClick={(e) => this.handleTabSelect(e, 'location')}
                        buttonType="primary"
                    />
                </div>
                <div className="nav-menu-content">
                    {
                        activeTab === 'messages'
                            && this.renderMessagesContent()
                    }
                    {
                        activeTab === 'forums'
                            && this.renderForumsContent()
                    }
                    {
                        activeTab === 'people'
                            && this.renderPeopleContent()
                    }
                    {
                        activeTab === 'location'
                            && this.renderLocationContent()
                    }
                </div>
                <div className="nav-menu-footer">
                    <SvgButton
                        id="nav_menu_footer_close"
                        name="close"
                        className="close-button"
                        onClick={toggleNavMenu}
                        buttonType="primary"
                    />
                </div>
            </>
        );
    }
}

export default connect(mapStateToProps, mapDispatchToProps)(MessagesMenuComponent);
