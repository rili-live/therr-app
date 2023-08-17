import * as React from 'react';
import { connect } from 'react-redux';
import classnames from 'classnames';
import {
    ButtonPrimary,
    InlineSvg,
    SvgButton,
} from 'therr-react/components';
import { ForumActions, UserConnectionsActions } from 'therr-react/redux/actions';
import {
    IForumsState,
    IUserState,
    IUserConnectionsState,
} from 'therr-react/types';
import { bindActionCreators } from 'redux';
import { NavigateFunction } from 'react-router-dom';
import translator from '../../services/translator';
import CreateConnectionForm from '../forms/CreateConnectionForm';
import withNavigation from '../../wrappers/withNavigation';

interface IMeassagesRouterProps {
    navigation: {
        navigate: NavigateFunction;
    }
}

interface IMessagesMenuDispatchProps {
    createUserConnection: Function;
    searchForums: Function;
    searchUserConnections: Function;
}

interface IStoreProps extends IMessagesMenuDispatchProps {
    forums: IForumsState;
    user: IUserState;
    userConnections: IUserConnectionsState;
}

// Regular component props
interface IMessagesMenuProps extends IStoreProps, IMeassagesRouterProps {
    toggleMessaging: Function;
    toggleNavMenu: Function;
    onInitMessaging: Function;
}

interface IMessagesMenuState {
    activeTab: string;
}

const mapStateToProps = (state: any) => ({
    forums: state.forums,
    user: state.user,
    userConnections: state.userConnections,
});

const mapDispatchToProps = (dispatch: any) => bindActionCreators({
    createUserConnection: UserConnectionsActions.create,
    searchForums: ForumActions.searchForums,
    searchUserConnections: UserConnectionsActions.search,
}, dispatch);

export class MessagesMenuComponent extends React.Component<IMessagesMenuProps, IMessagesMenuState> {
    private translate: Function;

    constructor(props) {
        super(props);

        this.state = {
            activeTab: 'messages',
        };

        this.translate = (key: string, params: any) => translator('en-us', key, params);
    }

    componentDidMount() {
        const {
            forums,
            searchForums,
            searchUserConnections,
            user,
            userConnections,
        } = this.props;

        if (!userConnections.connections.length) {
            searchUserConnections({
                filterBy: 'acceptingUserId',
                query: user.details.id,
                itemsPerPage: 50,
                pageNumber: 1,
                orderBy: 'interactionCount',
                order: 'desc',
                shouldCheckReverse: true,
            }, user.details.id).catch((err) => console.log(err));
        }

        if (forums && (!forums.searchResults || !forums.searchResults.length)) {
            searchForums({
                itemsPerPage: 40,
                pageNumber: 1,
                order: 'desc',
            }, {});
        }
    }

    handleTabSelect = (e, tabName) => {
        this.setState({
            activeTab: tabName,
        });
    };

    navigate = (destination, params?: any, state?: any) => (e) => {
        this.props.toggleNavMenu(e);
        this.props.toggleMessaging(e, true);

        switch (destination) {
            case 'create-forum':
                return this.props.navigation.navigate('/create-forum');
            case 'forums':
                return this.props.navigation.navigate(`/forums/${params.roomKey}`, {
                    state,
                });
            default:
        }
    };

    renderMessagesContent = () => {
        const { onInitMessaging, userConnections } = this.props;

        return (
            <>
                <h2>{this.translate('components.messagesMenu.h2.messaging')}</h2>
                <div className="messages-menu"></div>
                {
                    userConnections && userConnections.activeConnections.length > 0
                        ? <div className="realtime-connections-list">
                            {
                                userConnections.activeConnections.map((activeUser) => (
                                    <ButtonPrimary
                                        id="nav_menu_connection_link"
                                        key={activeUser.id}
                                        className={`connection-link-item right-icon ${activeUser.status === 'active' ? 'active' : 'away'}`}
                                        name={activeUser.id}
                                        onClick={(e) => onInitMessaging(e, activeUser, 'messages-menu')}
                                        buttonType="primary">
                                        {`${activeUser.firstName} ${activeUser.lastName}`}
                                        <InlineSvg name="messages" />
                                    </ButtonPrimary>
                                ))
                            }
                        </div>
                        : <div className="realtime-connections-list"><i>{this.translate('components.messagesMenu.noActiveConnections')}</i></div>
                }
            </>
        );
    };

    getForumItemClass = (forum) => {
        const { forums } = this.props;

        return classnames({
            'forum-link-item': true,
            'right-icon': true,
            active: forums.activeForums.find((f) => f.roomKey == forum.id), // eslint-disable-line eqeqeq
        });
    };

    renderForumsContent = () => {
        const { forums } = this.props;

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
                        forums && forums.searchResults.length > 0
                        && <div className="search-forums-list">
                            {
                                forums.searchResults.map((forum) => (
                                    <ButtonPrimary
                                        id="nav_menu_forum_link"
                                        key={forum.id}
                                        className={this.getForumItemClass(forum)}
                                        name={forum.title}
                                        onClick={this.navigate('forums', {
                                            roomKey: forum.id,
                                        }, {
                                            roomName: forum.title,
                                        })}
                                        buttonType="primary">
                                        {forum.title}
                                        <InlineSvg name="door" />
                                    </ButtonPrimary>
                                ))
                            }
                        </div>
                    }
                </div>
            </>
        );
    };

    renderPeopleContent = () => (
        <>
            <h2>{this.translate('components.messagesMenu.h2.friendRequest')}</h2>
            <div className="connection-form">
                <CreateConnectionForm
                    createUserConnection={this.props.createUserConnection}
                    user={this.props.user}
                />
            </div>
        </>
    );

    render() {
        const { activeTab } = this.state;
        const { toggleNavMenu } = this.props;

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
                    {/* <SvgButton
                        id="nav_menu_forums_button"
                        name="forum"
                        className={`menu-tab-button ${activeTab === 'forums' ? 'active' : ''}`}
                        iconClassName="tab-icon"
                        onClick={(e) => this.handleTabSelect(e, 'forums')}
                        buttonType="primary"
                    /> */}
                    <SvgButton
                        id="nav_menu_people"
                        name="people"
                        className={`menu-tab-button ${activeTab === 'people' ? 'active' : ''}`}
                        iconClassName="tab-icon"
                        onClick={(e) => this.handleTabSelect(e, 'people')}
                        buttonType="primary"
                    />
                </div>
                <div className="nav-menu-content">
                    {
                        activeTab === 'messages'
                            && this.renderMessagesContent()
                    }
                    {/* {
                        activeTab === 'forums'
                            && this.renderForumsContent()
                    } */}
                    {
                        activeTab === 'people'
                            && this.renderPeopleContent()
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

export default withNavigation(connect(mapStateToProps, mapDispatchToProps)(MessagesMenuComponent));
