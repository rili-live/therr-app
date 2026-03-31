/* eslint-disable max-len, react/jsx-no-target-blank, class-methods-use-this */
import * as React from 'react';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import { NavigateFunction } from 'react-router-dom';
import classnames from 'classnames';
import randomColor from 'randomcolor';
import {
    Anchor,
    Avatar,
    Badge,
    Breadcrumbs,
    Card,
    Container,
    Flex,
    Group as MantineGroup,
    Image,
    Paper,
    Stack,
    Tabs,
    Text,
    Title,
} from '@mantine/core';
import { ForumActions, MessageActions, SocketActions } from 'therr-react/redux/actions';
import {
    MantineButton,
    MantineInput,
} from 'therr-react/components/mantine';
import scrollTo from 'therr-js-utilities/scroll-to';
import { GroupMemberRoles, GroupRequestStatuses } from 'therr-js-utilities/constants';
import {
    IForumMsg,
    IForumsState,
    IMessagesState,
    IUserState,
} from 'therr-react/types';
import { UsersService } from 'therr-react/services';
import withNavigation from '../wrappers/withNavigation';
import withTranslation from '../wrappers/withTranslation';

const ITEMS_PER_PAGE = 50;

const userColors: any = {};

const renderMessage = (message: IForumMsg, index: number) => {
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
        <React.Fragment key={message.key || index}>
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

const renderEventCard = (event: any) => (
    <Card key={event.id} shadow="sm" padding="md" radius="md" withBorder mb="sm">
        <Anchor href={`/events/${event.id}`} underline="hover">
            <Title order={4}>{event.notificationMsg || event.title}</Title>
        </Anchor>
        {event.scheduleStartAt && (
            <Text size="sm" c="dimmed">
                {new Date(event.scheduleStartAt).toLocaleDateString(undefined, {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                })}
            </Text>
        )}
        {(event.message || event.description) && (
            <Text size="sm" mt="xs">{event.message || event.description}</Text>
        )}
        {event.hashTags && (
            <MantineGroup gap="xs" mt="xs">
                {event.hashTags.split(',').map((tag: string) => (
                    <Badge key={tag} variant="light" size="sm">{tag.trim()}</Badge>
                ))}
            </MantineGroup>
        )}
    </Card>
);

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

interface IViewGroupRouterProps {
    navigation: {
        navigate: NavigateFunction;
    };
    routeParams: {
        groupId: string;
    };
    location: any;
}

interface IViewGroupDispatchProps {
    getForumDetails: Function;
    joinForum: Function;
    leaveForum: Function;
    searchForumMessages: Function;
    sendForumMessage: Function;
}

interface IStoreProps extends IViewGroupDispatchProps {
    forums: IForumsState;
    messages: IMessagesState;
    user: IUserState;
}

interface IViewGroupProps extends IViewGroupRouterProps, IStoreProps {
    translate: (key: string, params?: any) => string;
}

interface IViewGroupState {
    groupId: string;
    activeTab: string;
    inputs: any;
    groupMembers: any[];
}

const mapStateToProps = (state: any) => ({
    forums: state.forums,
    messages: state.messages,
    user: state.user,
});

const mapDispatchToProps = (dispatch: any) => bindActionCreators({
    getForumDetails: ForumActions.getForumDetails,
    joinForum: SocketActions.joinForum,
    leaveForum: SocketActions.leaveForum,
    searchForumMessages: MessageActions.searchForumMessages,
    sendForumMessage: SocketActions.sendForumMessage,
}, dispatch);

/**
 * ViewGroup - Public read-only / full interactive group page
 */
export class ViewGroupComponent extends React.Component<IViewGroupProps, IViewGroupState> {
    private messageInputRef: any;

    static getDerivedStateFromProps(nextProps: IViewGroupProps) {
        if (!nextProps.routeParams.groupId) {
            setTimeout(() => nextProps.navigation.navigate('/'));
            return null;
        }
        return {};
    }

    constructor(props: IViewGroupProps) {
        super(props);

        this.state = {
            groupId: props.routeParams.groupId,
            activeTab: 'events',
            inputs: {},
            groupMembers: [],
        };

        this.messageInputRef = React.createRef();
    }

    componentDidMount() {
        const { getForumDetails, forums, user } = this.props;
        const { groupId } = this.state;
        const group = forums?.forumDetails?.[groupId];
        const isAuthenticated = !!user?.details?.id;

        if (!group) {
            getForumDetails(groupId).then((fetchedGroup: any) => {
                if (fetchedGroup?.title) {
                    document.title = `${fetchedGroup.title} | Therr App`;
                }
            }).catch((err: any) => {
                console.log('Failed to fetch group details', err); // eslint-disable-line no-console
                this.props.navigation.navigate('/');
            });
        } else if (group?.title) {
            document.title = `${group.title} | Therr App`;
        }

        if (isAuthenticated) {
            this.setState({ activeTab: 'chat' });
            this.initAuthenticatedFeatures();
        }
    }

    componentDidUpdate(prevProps: IViewGroupProps) {
        const { messages, user } = this.props;
        const isAuthenticated = !!user?.details?.id;

        if (isAuthenticated) {
            const currentRoom = user.socketDetails.currentRoom;
            const forumMessages = messages.forumMsgs[currentRoom];
            const prevMessages = prevProps.messages.forumMsgs[currentRoom];
            if (forumMessages && forumMessages.length > 3 && prevMessages && forumMessages.length > prevMessages.length) {
                scrollTo(document.body.scrollHeight, 100);
            }
        }
    }

    componentWillUnmount() {
        const { user } = this.props;
        const isAuthenticated = !!user?.details?.id;

        if (isAuthenticated) {
            this.props.leaveForum({
                roomId: this.state.groupId,
                userName: user.details.userName,
                userImgSrc: `https://robohash.org/${user.details.id}`,
            });
        }
    }

    fetchGroupMembers = () => {
        const { groupId } = this.state;

        UsersService.getGroupMembers(groupId).then((response: any) => {
            this.setState({
                groupMembers: response?.data?.userGroups || [],
            });
        }).catch((err: any) => {
            console.log('Failed to fetch group members', err); // eslint-disable-line no-console
        });
    };

    initAuthenticatedFeatures = () => {
        const { searchForumMessages, user } = this.props;
        const { groupId } = this.state;

        this.props.joinForum({
            roomId: groupId,
            roomName: groupId,
            userId: user.details.id,
            userName: user.details.userName,
            userImgSrc: `https://robohash.org/${user.details.id}`,
        });

        searchForumMessages(groupId, user.details.id, {
            itemsPerPage: ITEMS_PER_PAGE,
            pageNumber: 1,
        });

        this.fetchGroupMembers();

        this.messageInputRef.current?.focus();
    };

    onInputChange = (name: string, value: string) => {
        this.setState({
            inputs: {
                ...this.state.inputs,
                [name]: value,
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

    isGroupAdmin = (): boolean => {
        const { forums, user } = this.props;
        const { groupId } = this.state;
        const group = forums?.forumDetails?.[groupId];
        if (!group || !user?.details?.id) return false;

        const userId = String(user.details.id);
        if (String(group.authorId) === userId) return true;

        const adminIds = group.administratorIds
            ? String(group.administratorIds).split(',').map((id: string) => id.trim())
            : [];
        return adminIds.includes(userId);
    };

    renderBreadcrumbs(groupTitle: string): JSX.Element {
        const items = [
            <Anchor href="/" key="home">{this.props.translate('pages.navigation.home')}</Anchor>,
            <Anchor href="/groups" key="groups">{this.props.translate('pages.navigation.groups')}</Anchor>,
            <Text key="title" component="span">{groupTitle}</Text>,
        ];

        return <Breadcrumbs className="group-breadcrumbs">{items}</Breadcrumbs>;
    }

    renderChatTab = () => {
        const { messages, user } = this.props;
        const forumMsgsRaw = messages.forumMsgs[user.socketDetails.currentRoom];
        const forumMessages = forumMsgsRaw ? [...forumMsgsRaw].reverse() : forumMsgsRaw;

        return (
            <div className="forum-chat-tab">
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
                    <Flex gap="sm" align="flex-end">
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
            </div>
        );
    };

    renderEventsTab = (groupEvents: any[]) => {
        if (!groupEvents || groupEvents.length === 0) {
            return (
                <Card shadow="sm" padding="lg" radius="md" withBorder>
                    <Text c="dimmed" ta="center">{this.props.translate('pages.viewGroup.labels.noEvents')}</Text>
                </Card>
            );
        }

        const now = new Date();
        const upcomingEvents = groupEvents
            .filter((event: any) => new Date(event.scheduleStartAt) >= now)
            .sort((a: any, b: any) => new Date(a.scheduleStartAt).getTime() - new Date(b.scheduleStartAt).getTime());
        const pastEvents = groupEvents
            .filter((event: any) => new Date(event.scheduleStartAt) < now)
            .sort((a: any, b: any) => new Date(b.scheduleStartAt).getTime() - new Date(a.scheduleStartAt).getTime());

        return (
            <div className="events-list">
                {upcomingEvents.length > 0 && (
                    <div className="events-section">
                        <Title order={3} mb="sm">{this.props.translate('pages.viewGroup.labels.upcomingEvents')}</Title>
                        {upcomingEvents.map(renderEventCard)}
                    </div>
                )}
                {pastEvents.length > 0 && (
                    <div className="events-section" style={{ marginTop: upcomingEvents.length > 0 ? 'var(--mantine-spacing-lg)' : undefined }}>
                        <Title order={3} mb="sm">{this.props.translate('pages.viewGroup.labels.pastEvents')}</Title>
                        {pastEvents.map(renderEventCard)}
                    </div>
                )}
            </div>
        );
    };

    renderMembersTabAuthenticated = () => {
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

    renderLoginLinks(): JSX.Element {
        return (
            <MantineGroup gap="sm" justify="center">
                <Anchor href="/login">{this.props.translate('components.header.buttons.login')}</Anchor>
                <Anchor href="/register">{this.props.translate('pages.login.buttons.signUp')}</Anchor>
            </MantineGroup>
        );
    }

    renderMembersTabPublic = () => {
        const { groupMembers } = this.state;

        return (
            <Card shadow="sm" padding="lg" radius="md" withBorder>
                <Stack gap="md" align="center">
                    <Text fw={500}>
                        {this.props.translate('pages.viewGroup.labels.memberCount', { count: groupMembers.length || '—' })}
                    </Text>
                    <Text c="dimmed" ta="center">{this.props.translate('pages.viewGroup.labels.joinToSeeMembers')}</Text>
                    {this.renderLoginLinks()}
                </Stack>
            </Card>
        );
    };

    renderPrivateGroupMessage(): JSX.Element {
        return (
            <Container id="page_view_group" size="md" py="xl">
                <Stack gap="md" align="center">
                    <Title order={2}>{this.props.translate('pages.viewGroup.labels.privateGroupMessage')}</Title>
                    <Text c="dimmed" ta="center">{this.props.translate('pages.viewGroup.labels.privateGroupCta')}</Text>
                    {this.renderLoginLinks()}
                </Stack>
            </Container>
        );
    }

    renderSignUpCta(): JSX.Element {
        return (
            <Paper withBorder p="lg" radius="md" className="event-cta-card">
                <Text fw={600} ta="center">{this.props.translate('pages.viewGroup.labels.signUpPrompt')}</Text>
                {this.renderLoginLinks()}
            </Paper>
        );
    }

    renderAppDownloadBanner(): JSX.Element {
        return (
            <Paper withBorder p="lg" radius="md" mt="md" className="event-cta-card">
                <Text fw={600} ta="center">{this.props.translate('pages.viewGroup.labels.getFullExperience')}</Text>
                <MantineGroup justify="center" mt="sm" gap="md">
                    <Anchor href="https://apps.apple.com/us/app/therr/id1569988763?platform=iphone" target="_blank" rel="noreferrer">
                        <Image aria-label="apple store link" maw={120} src="/assets/images/apple-store-download-button.svg" alt="Download Therr on the App Store" />
                    </Anchor>
                    <Anchor href="https://play.google.com/store/apps/details?id=app.therrmobile" target="_blank" rel="noreferrer">
                        <Image aria-label="play store link" maw={120} src="/assets/images/play-store-download-button.svg" alt="Download Therr on Google Play" />
                    </Anchor>
                </MantineGroup>
            </Paper>
        );
    }

    public render(): JSX.Element {
        const { forums, user } = this.props;
        const { activeTab, groupId } = this.state;
        const group = forums?.forumDetails?.[groupId];
        const isAuthenticated = !!user?.details?.id;

        // Private group check for unauthenticated users
        if (group && !group.isPublic && !isAuthenticated) {
            return this.renderPrivateGroupMessage();
        }

        const groupTitle = group?.title || '';
        const subtitle = group?.subtitle;
        const description = group?.description;
        const hashtags = group?.hashTags ? group.hashTags.split(',') : [];
        const featuredImage = group?.featuredImage || group?.media?.[0]?.path;
        const groupEvents = group?.events || [];
        const locationText = [group?.city, group?.region].filter(Boolean).join(', ');

        return (
            <div id="page_view_group">
                <Container size="md">
                    <Stack gap="md" style={{ minHeight: 'calc(100vh - 200px)' }}>
                        {/* Breadcrumbs */}
                        {groupTitle && this.renderBreadcrumbs(groupTitle)}

                        {/* Group Info Header */}
                        <Card shadow="sm" padding="lg" radius="md" withBorder>
                            <div className="forum-header">
                                <Avatar
                                    src={featuredImage || null}
                                    radius="md"
                                    size="xl"
                                    color="blue"
                                >
                                    {groupTitle?.charAt(0)?.toUpperCase() || 'G'}
                                </Avatar>
                                <div className="forum-header-info">
                                    <Title order={1} size="h2">{groupTitle}</Title>
                                    {locationText && <Text size="sm" c="dimmed">{locationText}</Text>}
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
                                    {this.isGroupAdmin() && (
                                        <MantineButton
                                            id="edit_group"
                                            text={this.props.translate('pages.viewGroup.buttons.editGroup')}
                                            onClick={() => this.props.navigation.navigate(`/groups/${groupId}/edit`)}
                                            variant="outline"
                                            mt="sm"
                                        />
                                    )}
                                </div>
                            </div>
                        </Card>

                        {/* App Download Banner */}
                        {this.renderAppDownloadBanner()}

                        {/* Login/Signup CTA for unauthenticated users */}
                        {!isAuthenticated && this.renderSignUpCta()}

                        {/* Tabs */}
                        <div className="forum-tabs-container">
                            <Tabs
                                value={activeTab}
                                onChange={(value) => this.setState({ activeTab: value || 'events' })}
                                classNames={{
                                    tab: 'forum-tab',
                                    list: 'forum-tabs-list',
                                }}
                            >
                                <Tabs.List grow>
                                    {isAuthenticated && (
                                        <Tabs.Tab value="chat">
                                            {this.props.translate('pages.chatForum.tabs.chat')}
                                        </Tabs.Tab>
                                    )}
                                    <Tabs.Tab value="events">
                                        {this.props.translate('pages.viewGroup.headings.events')}
                                    </Tabs.Tab>
                                    <Tabs.Tab value="members">
                                        {this.props.translate('pages.viewGroup.headings.members')}
                                    </Tabs.Tab>
                                </Tabs.List>
                            </Tabs>
                        </div>

                        {isAuthenticated && activeTab === 'chat' && this.renderChatTab()}
                        {activeTab === 'events' && this.renderEventsTab(groupEvents)}
                        {activeTab === 'members' && (isAuthenticated ? this.renderMembersTabAuthenticated() : this.renderMembersTabPublic())}
                    </Stack>
                </Container>
            </div>
        );
    }
}

export default withNavigation(withTranslation(connect(mapStateToProps, mapDispatchToProps)(ViewGroupComponent)));
