import * as React from 'react';
import { connect } from 'react-redux';
import classnames from 'classnames';
import {
    InlineSvg,
    SvgButton,
} from 'therr-react/components';
import { MantineButton } from 'therr-react/components/mantine';
import { ForumActions, UserConnectionsActions } from 'therr-react/redux/actions';
import {
    IForumsState,
    IUserState,
    IUserConnectionsState,
} from 'therr-react/types';
import { bindActionCreators } from 'redux';
import { NavigateFunction } from 'react-router-dom';
import CreateConnectionForm from '../forms/CreateConnectionForm';
import withNavigation from '../../wrappers/withNavigation';
import withTranslation from '../../wrappers/withTranslation';

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
    translate: (key: string, params?: any) => string;
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
    constructor(props) {
        super(props);

        this.state = {
            activeTab: 'forums',
        };
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
            case 'browse-groups':
                return this.props.navigation.navigate('/groups');
            case 'forums':
                return this.props.navigation.navigate(`/groups/${params.roomKey}`, {
                    state,
                });
            default:
        }
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
                <h2>{this.props.translate('components.messagesMenu.h2.forums')}</h2>
                <div className="forums-menu">
                    <MantineButton
                        id="nav_menu_browse_groups"
                        className="menu-item left-icon"
                        onClick={this.navigate('browse-groups')}
                        variant="subtle"
                        fullWidth
                    >
                        <InlineSvg name="door" />
                        {this.props.translate('components.messagesMenu.buttons.browseGroups')}
                    </MantineButton>
                    <MantineButton
                        id="nav_menu_join_forum"
                        className="menu-item left-icon"
                        onClick={this.navigate('create-forum')}
                        variant="subtle"
                        fullWidth
                    >
                        <InlineSvg name="add-circle" />
                        {this.props.translate('components.messagesMenu.buttons.createForum')}
                    </MantineButton>
                    {
                        forums && forums.searchResults.length > 0
                        && <div className="search-forums-list">
                            {
                                forums.searchResults.map((forum) => (
                                    <MantineButton
                                        id="nav_menu_forum_link"
                                        key={forum.id}
                                        className={this.getForumItemClass(forum)}
                                        onClick={this.navigate('forums', {
                                            roomKey: forum.id,
                                        }, {
                                            roomName: forum.title,
                                        })}
                                        variant="subtle"
                                        fullWidth
                                    >
                                        {forum.title}
                                        <InlineSvg name="door" />
                                    </MantineButton>
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
            <h2>{this.props.translate('components.messagesMenu.h2.friendRequest')}</h2>
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
                </div>
                <div className="nav-menu-content">
                    {
                        activeTab === 'people'
                            && this.renderPeopleContent()
                    }
                    {
                        activeTab === 'forums'
                            && this.renderForumsContent()
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

export default withNavigation(withTranslation(connect(mapStateToProps, mapDispatchToProps)(MessagesMenuComponent)));
