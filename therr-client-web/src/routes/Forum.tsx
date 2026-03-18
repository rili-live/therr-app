import * as React from 'react';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import classnames from 'classnames';
import randomColor from 'randomcolor';
import {
    Avatar,
    Badge,
    Card,
    Container,
    Flex,
    Group as MantineGroup,
    Stack,
    Tabs,
    Text,
    Title,
} from '@mantine/core';
import { MessageActions, SocketActions } from 'therr-react/redux/actions';
import {
    MantineButton,
    MantineInput,
} from 'therr-react/components/mantine';
import scrollTo from 'therr-js-utilities/scroll-to';
import { GroupMemberRoles, GroupRequestStatuses } from 'therr-js-utilities/constants';
import {
    IForumMsg,
    IMessagesState,
    IUserState,
} from 'therr-react/types';
import { ForumsService, UsersService } from 'therr-react/services';
import withNavigation from '../wrappers/withNavigation';
import withTranslation from '../wrappers/withTranslation';

const ITEMS_PER_PAGE = 50;

const userColors: any = {}; // local state

const verifyAndJoinForum = (props) => {
    props.joinForum({
        roomId: props.routeParams?.groupId,
        roomName: (props.location?.state as any)?.roomName,
        userId: props.user.details.id,
        userName: props.user.details.userName,
        userImgSrc: `https://robohash.org/${props.user.details.id}`,
    });
};

const renderMessage = (message: IForumMsg, index) => {
    const senderTitle = !message.isAnnouncement ? message.fromUserName : '';
    const isYou = message.fromUserName?.toLowerCase() === 'you';
    const yourColor = 'green';
    const timeSplit = message.time.split(', ');
    const msgClassNames = classnames({
        'forum-message': true,
        indented: message.isAnnouncement,
    });

    if (!userColors[message.fromUserName]) {
        userColors[message.fromUserName] = isYou ? yourColor : randomColor({
            luminosity: 'dark',
        });
    }

    const messageColor = isYou
        ? (userColors[message.fromUserName] || yourColor)
        : (userColors[message.fromUserName] || 'blue');

    return (
        <React.Fragment key={message.key}>
            {
                (index !== 0 && index % 10 === 0)
                    && <div className="forums-messages-date">{timeSplit[0]}</div>
            }
            <div
                className={msgClassNames}
                style={{
                    borderLeftColor: messageColor,
                }}
            >
                <div className="forum-message-user-image">
                    {message.fromUserImgSrc && <img
                        src={`${message.fromUserImgSrc}?size=50x50`}
                        alt={`Profile: ${message.fromUserName || ''}`}
                        width="50"
                        height="50"
                        loading="lazy"
                    />}
                </div>
                <div className="forum-message-content-container">
                    <div className="forum-message-header">
                        {
                            !!senderTitle && <div className="sender-text">{senderTitle}</div>
                        }
                        <div className="forum-message-time">{timeSplit[1]}</div>
                    </div>
                    <div>{message.text}</div>
                </div>
            </div>
        </React.Fragment>
    );
};

// router params
interface IForumRouterProps {
    roomName: string;
    groupId: string;
}

interface IForumDispatchProps {
    joinForum: Function;
    leaveForum: Function;
    searchForumMessages: Function;
    sendForumMessage: Function;
}

interface IStoreProps extends IForumDispatchProps {
    messages: IMessagesState;
    user: IUserState;
    routeParams: IForumRouterProps
}

// Regular component props
interface IForumProps extends IStoreProps {
    location: any;
    navigation: {
        navigate: Function;
    };
    translate: (key: string, params?: any) => string;
}

interface IForumState {
    activeTab: string;
    inputs: any;
    isFirstLoad: boolean;
    previousGroupId: string;
    groupDetails: any;
    groupEvents: any[];
    groupMembers: any[];
}

// Environment Variables
// const envVars = globalConfig[process.env.NODE_ENV];

const mapStateToProps = (state: IForumState | any) => ({
    messages: state.messages,
    user: state.user,
});

const mapDispatchToProps = (dispatch: any) => bindActionCreators({
    joinForum: SocketActions.joinForum,
    leaveForum: SocketActions.leaveForum,
    searchForumMessages: MessageActions.searchForumMessages,
    sendForumMessage: SocketActions.sendForumMessage,
}, dispatch);

const getRoleBadgeColor = (role: string): string => {
    switch (role) {
        case GroupMemberRoles.CREATOR:
            return 'violet';
        case GroupMemberRoles.ADMIN:
            return 'blue';
        case GroupMemberRoles.EVENT_HOST:
            return 'orange';
        default:
            return 'gray';
    }
};

/**
 * Forum
 */
export class ForumComponent extends React.Component<IForumProps, IForumState> {
    static getDerivedStateFromProps(nextProps: IForumProps, nextState: IForumState) {
        if (nextState.isFirstLoad || nextProps.routeParams?.groupId !== nextState.previousGroupId) {
            verifyAndJoinForum(nextProps);

            return {
                isFirstLoad: false,
                previousGroupId: nextProps.routeParams?.groupId,
            };
        }
        return {};
    }

    private messageInputRef: any;

    constructor(props: IForumProps) {
        super(props);

        this.state = {
            activeTab: 'chat',
            inputs: {},
            isFirstLoad: true,
            previousGroupId: props.routeParams?.groupId,
            groupDetails: null,
            groupEvents: [],
            groupMembers: [],
        };

        this.messageInputRef = React.createRef();
    }

    componentDidMount() {
        const { routeParams, searchForumMessages, user } = this.props;
        document.title = `Therr | ${this.props.translate('pages.chatForum.pageTitle')}`;
        this.messageInputRef.current?.focus();

        const groupId = routeParams?.groupId;

        if (groupId) {
            searchForumMessages(groupId, user.details.id, {
                itemsPerPage: ITEMS_PER_PAGE,
                pageNumber: 1,
            });

            ForumsService.getForum(groupId).then((response) => {
                const groupDetails = response?.data;
                this.setState({
                    groupDetails,
                    groupEvents: groupDetails?.events || [],
                });
                if (groupDetails?.title) {
                    document.title = `Therr | ${groupDetails.title}`;
                }
            }).catch((err) => {
                console.log('Failed to fetch group details', err); // eslint-disable-line no-console
            });

            UsersService.getGroupMembers(groupId).then((response) => {
                this.setState({
                    groupMembers: response?.data?.userGroups || [],
                });
            }).catch((err) => {
                console.log('Failed to fetch group members', err); // eslint-disable-line no-console
            });
        }
    }

    componentDidUpdate(prevProps: IForumProps) {
        const currentRoom = this.props.user.socketDetails.currentRoom;
        const messages = this.props.messages.forumMsgs[currentRoom];
        const prevMessages = prevProps.messages.forumMsgs[currentRoom];
        if (messages && messages.length > 3 && prevMessages && messages.length > prevMessages.length) {
            scrollTo(document.body.scrollHeight, 100);
        }
    }

    componentWillUnmount() {
        this.props.leaveForum({
            roomId: this.props.routeParams?.groupId,
            userName: this.props.user.details.userName,
            userImgSrc: `https://robohash.org/${this.props.user.details.id}`,
        });
    }

    onInputChange = (name: string, value: string) => {
        const newInputChanges = {
            [name]: value,
        };
        this.setState({
            inputs: {
                ...this.state.inputs,
                ...newInputChanges,
            },
        });
    };

    onButtonClick = (event: any) => {
        event.preventDefault();
        switch (event.target.id) {
            case 'enter_message':
            case 'message':
                this.props.sendForumMessage({
                    roomId: this.props.user.socketDetails.currentRoom,
                    message: this.state.inputs.message,
                    userId: this.props.user.details.id,
                    userName: this.props.user.details.userName,
                    userImgSrc: `https://robohash.org/${this.props.user.details.id}`,
                });
                return this.onInputChange('message', '');
            default:
        }
    };

    shouldDisableInput = (buttonName: string) => {
        switch (buttonName) {
            case 'sendForumMessage':
                return !this.state.inputs.message;
            default:
                return false;
        }
    };

    getSortedMembers = () => {
        const { groupMembers } = this.state;
        const nonDefaultRoles: any[] = [];
        const defaultRoles: any[] = [];

        groupMembers.forEach((member) => {
            if (member.role === GroupMemberRoles.ADMIN || member.role === GroupMemberRoles.CREATOR) {
                nonDefaultRoles.unshift(member);
            } else if (member.role === GroupMemberRoles.EVENT_HOST) {
                nonDefaultRoles.push(member);
            } else {
                defaultRoles.push(member);
            }
        });

        return nonDefaultRoles.concat(defaultRoles);
    };

    getMembershipText = (member: any): string => {
        if (member?.status === GroupRequestStatuses.PENDING) {
            return 'Pending';
        }
        if (member?.role === GroupMemberRoles.CREATOR) {
            return this.props.translate('pages.chatForum.membershipRoles.creator');
        }
        if (member?.role === GroupMemberRoles.ADMIN) {
            return this.props.translate('pages.chatForum.membershipRoles.admin');
        }
        if (member?.role === GroupMemberRoles.EVENT_HOST) {
            return this.props.translate('pages.chatForum.membershipRoles.eventHost');
        }
        return this.props.translate('pages.chatForum.membershipRoles.default');
    };

    renderChatTab = () => {
        const { messages, user } = this.props;
        const forumMsgsRaw = messages.forumMsgs[user.socketDetails.currentRoom];
        const forumMessages = forumMsgsRaw ? [...forumMsgsRaw].reverse() : forumMsgsRaw;

        return (
            <>
                <Card shadow="sm" padding="md" radius="md" withBorder style={{ flex: 1 }}>
                    <div id="forums_list">
                        {
                            forumMessages && forumMessages.length > 0
                                ? <div className="message-list">
                                    {
                                        forumMessages.map((msg: IForumMsg, index) => renderMessage(msg, index))
                                    }
                                </div>
                                : <Text c="dimmed">{this.props.translate('pages.chatForum.welcome')}</Text>
                        }
                    </div>
                </Card>

                <Card shadow="sm" padding="md" radius="md" withBorder>
                    <Flex gap="sm" align="center">
                        <div style={{ flex: 1 }}>
                            <MantineInput
                                ref={this.messageInputRef}
                                autoComplete="off"
                                type="text"
                                id="message"
                                name="message"
                                value={this.state.inputs.message}
                                onChange={this.onInputChange}
                                onEnter={this.onButtonClick}
                                placeholder={this.props.translate('pages.chatForum.inputPlaceholder')}
                                translateFn={this.props.translate}
                            />
                        </div>
                        <MantineButton
                            id="enter_message"
                            text={this.props.translate('pages.chatForum.sendBtn')}
                            onClick={this.onButtonClick}
                            disabled={this.shouldDisableInput('sendForumMessage')}
                        />
                    </Flex>
                </Card>
            </>
        );
    };

    renderEventsTab = () => {
        const { groupEvents } = this.state;

        if (!groupEvents || groupEvents.length === 0) {
            return (
                <Card shadow="sm" padding="lg" radius="md" withBorder>
                    <Text c="dimmed" ta="center">{this.props.translate('pages.chatForum.noEventsFound')}</Text>
                </Card>
            );
        }

        return (
            <div className="events-list">
                {groupEvents.map((event: any) => (
                    <Card key={event.id} shadow="sm" padding="md" radius="md" withBorder mb="sm">
                        <Title order={4}>{event.title}</Title>
                        {event.startDate && (
                            <Text size="sm" c="dimmed">
                                {new Date(event.startDate).toLocaleDateString(undefined, {
                                    weekday: 'long',
                                    year: 'numeric',
                                    month: 'long',
                                    day: 'numeric',
                                })}
                            </Text>
                        )}
                        {event.description && (
                            <Text size="sm" mt="xs">{event.description}</Text>
                        )}
                        {event.hashTags && (
                            <MantineGroup gap="xs" mt="xs">
                                {event.hashTags.split(',').map((tag: string) => (
                                    <Badge key={tag} variant="light" size="sm">{tag.trim()}</Badge>
                                ))}
                            </MantineGroup>
                        )}
                    </Card>
                ))}
            </div>
        );
    };

    renderMembersTab = () => {
        const sortedMembers = this.getSortedMembers();

        if (!sortedMembers || sortedMembers.length === 0) {
            return (
                <Card shadow="sm" padding="lg" radius="md" withBorder>
                    <Text c="dimmed" ta="center">{this.props.translate('pages.chatForum.noMembersFound')}</Text>
                </Card>
            );
        }

        return (
            <div className="members-list">
                {sortedMembers.map((member: any) => {
                    const memberUser = member.user || {};
                    const userId = member.userId || memberUser.id;
                    const displayName = memberUser.userName || memberUser.email || 'Unknown';
                    const roleText = this.getMembershipText(member);
                    const badgeColor = getRoleBadgeColor(member.role);

                    return (
                        <Card
                            key={member.id || userId}
                            shadow="sm"
                            padding="sm"
                            radius="md"
                            withBorder
                            mb="xs"
                            className="member-card"
                            onClick={() => userId && this.props.navigation.navigate(`/users/${userId}`)}
                            style={{ cursor: userId ? 'pointer' : 'default' }}
                        >
                            <Flex align="center" gap="sm">
                                <Avatar
                                    src={memberUser.media?.profilePicture || null}
                                    radius="xl"
                                    size="md"
                                    color="blue"
                                >
                                    {displayName.charAt(0).toUpperCase()}
                                </Avatar>
                                <div style={{ flex: 1 }}>
                                    <Text fw={500} size="sm">{displayName}</Text>
                                </div>
                                <Badge variant="light" color={badgeColor} size="sm">
                                    {roleText}
                                </Badge>
                            </Flex>
                        </Card>
                    );
                })}
            </div>
        );
    };

    render() {
        const { location, user } = this.props;
        const { activeTab, groupDetails } = this.state;

        const roomName = groupDetails?.title
            || (location.state as any)?.roomName
            || user.socketDetails.currentRoom;
        const subtitle = groupDetails?.subtitle;
        const description = groupDetails?.description;
        const hashtags = groupDetails?.hashTags ? groupDetails.hashTags.split(',') : [];
        const featuredImage = groupDetails?.featuredImage || groupDetails?.media?.[0]?.path;

        return (
            <div id="page_chat_forum">
                <Container size="md">
                    <Stack gap="md" style={{ minHeight: 'calc(100vh - 200px)' }}>
                        {/* Group Info Header */}
                        <Card shadow="sm" padding="lg" radius="md" withBorder>
                            <div className="forum-header">
                                <Avatar
                                    src={featuredImage || null}
                                    radius="md"
                                    size="xl"
                                    color="blue"
                                >
                                    {roomName?.charAt(0)?.toUpperCase() || 'G'}
                                </Avatar>
                                <div className="forum-header-info">
                                    <Title order={2}>{roomName}</Title>
                                    {subtitle && <Text size="sm" c="dimmed">{subtitle}</Text>}
                                    {description && (
                                        <Text size="sm" mt="xs" className="forum-description" lineClamp={3}>
                                            {description}
                                        </Text>
                                    )}
                                    {hashtags.length > 0 && (
                                        <MantineGroup gap="xs" mt="xs">
                                            {hashtags.map((tag: string) => (
                                                <Badge key={tag} variant="light" size="sm">
                                                    {tag.trim().startsWith('#') ? tag.trim() : `#${tag.trim()}`}
                                                </Badge>
                                            ))}
                                        </MantineGroup>
                                    )}
                                </div>
                            </div>
                        </Card>

                        {/* App Download Banner */}
                        <Card shadow="sm" padding="xs" radius={0} withBorder className="app-banner">
                            <Flex align="center" justify="center" gap="sm" wrap="wrap">
                                <Text size="sm" fw={500}>
                                    {this.props.translate('pages.chatForum.appBanner.message')}
                                </Text>
                                <Flex gap="xs">
                                    <a href="https://apps.apple.com/us/app/therr/id1569988763?platform=iphone" target="_blank" rel="noreferrer">
                                        <img
                                            src="/assets/images/apple-store-download-button.svg"
                                            alt={this.props.translate('pages.chatForum.appBanner.appStoreAlt')}
                                            width="110"
                                            height="36"
                                            loading="lazy"
                                        />
                                    </a>
                                    <a href="https://play.google.com/store/apps/details?id=app.therrmobile" target="_blank" rel="noreferrer">
                                        <img
                                            src="/assets/images/play-store-download-button.svg"
                                            alt={this.props.translate('pages.chatForum.appBanner.playStoreAlt')}
                                            width="110"
                                            height="36"
                                            loading="lazy"
                                        />
                                    </a>
                                </Flex>
                            </Flex>
                        </Card>

                        {/* Tabs: Chat / Events / Members */}
                        <div className="forum-tabs-container">
                            <Tabs
                                value={activeTab}
                                onChange={(value) => this.setState({ activeTab: value || 'chat' })}
                                classNames={{
                                    tab: 'forum-tab',
                                    list: 'forum-tabs-list',
                                }}
                            >
                                <Tabs.List grow>
                                    <Tabs.Tab value="chat">
                                        {this.props.translate('pages.chatForum.tabs.chat')}
                                    </Tabs.Tab>
                                    <Tabs.Tab value="events">
                                        {this.props.translate('pages.chatForum.tabs.events')}
                                    </Tabs.Tab>
                                    <Tabs.Tab value="members">
                                        {this.props.translate('pages.chatForum.tabs.members')}
                                    </Tabs.Tab>
                                </Tabs.List>
                            </Tabs>
                        </div>

                        {activeTab === 'chat' && this.renderChatTab()}
                        {activeTab === 'events' && this.renderEventsTab()}
                        {activeTab === 'members' && this.renderMembersTab()}
                    </Stack>
                </Container>
            </div>
        );
    }
}

export default withNavigation(withTranslation(connect(mapStateToProps, mapDispatchToProps)(ForumComponent)));
