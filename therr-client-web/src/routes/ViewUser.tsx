/* eslint-disable max-len, react/jsx-no-target-blank, class-methods-use-this */
import * as React from 'react';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import { NavigateFunction } from 'react-router-dom';
import { IUserState, IUserConnectionsState } from 'therr-react/types';
import { UserConnectionsActions } from 'therr-react/redux/actions';
import { MapsService, UsersService } from 'therr-react/services';
import {
    Container, Stack, Group, Title, Text, Anchor,
    Divider, Avatar, Skeleton, Breadcrumbs, Button,
    SimpleGrid,
} from '@mantine/core';
import UsersActions from '../redux/actions/UsersActions';
import withNavigation from '../wrappers/withNavigation';
import withTranslation from '../wrappers/withTranslation';
import getUserImageUri from '../utilities/getUserImageUri';
import BusinessSpaceCard from '../components/business-profile/BusinessSpaceCard';
import BusinessEventCard from '../components/business-profile/BusinessEventCard';
import BusinessUpdateCard from '../components/business-profile/BusinessUpdateCard';

interface IViewUserRouterProps {
    navigation: {
        navigate: NavigateFunction;
    };
    routeParams: {
        userId: string;
    }
}

interface IViewUserDispatchProps {
    getUser: Function;
    searchUserConnections: Function;
}

interface IStoreProps extends IViewUserDispatchProps {
    user: IUserState;
    userConnections: IUserConnectionsState;
}

// Regular component props
interface IViewUserProps extends IViewUserRouterProps, IStoreProps {
    onInitMessaging?: Function;
    translate: (key: string, params?: any) => string;
}

interface IViewUserState {
    userId: string;
    userSpaces: any[];
    userEvents: any[];
    userThoughts: any[];
    isBusinessDataLoading: boolean;
}

const mapStateToProps = (state: any) => ({
    user: state.user,
    userConnections: state.userConnections,
});

const mapDispatchToProps = (dispatch: any) => bindActionCreators({
    getUser: UsersActions.get,
    searchUserConnections: UserConnectionsActions.search,
}, dispatch);

/**
 * ViewUser
 */
export class ViewUserComponent extends React.Component<IViewUserProps, IViewUserState> {
    static getDerivedStateFromProps(nextProps: IViewUserProps) {
        if (!nextProps.routeParams.userId) {
            setTimeout(() => nextProps.navigation.navigate('/'));
            return null;
        }
        return {};
    }

    constructor(props: IViewUserProps) {
        super(props);

        this.state = {
            userId: props.routeParams.userId,
            userSpaces: [],
            userEvents: [],
            userThoughts: [],
            isBusinessDataLoading: false,
        };
    }

    componentDidMount() { // eslint-disable-line class-methods-use-this
        this.fetchUserData();
    }

    componentDidUpdate(prevProps: IViewUserProps) {
        const { routeParams } = this.props;
        if (prevProps.routeParams.userId !== routeParams.userId) {
            this.setState({ userId: routeParams.userId }, () => {
                this.fetchUserData();
            });
        }
    }

    fetchUserData = () => {
        const {
            getUser, searchUserConnections, user, userConnections,
        } = this.props;

        getUser(this.state.userId).then((fetchedUser: any) => {
            const displayName = fetchedUser?.isBusinessAccount
                ? fetchedUser.firstName
                : `${fetchedUser?.firstName} ${fetchedUser?.lastName}`;
            document.title = `${displayName} | Therr App`;

            if (fetchedUser?.isBusinessAccount) {
                this.fetchBusinessData();
            } else {
                this.fetchUserThoughts();
            }
        }).catch(() => {
            this.props.navigation.navigate('/');
        });

        if (user.isAuthenticated && !userConnections.connections.length) {
            searchUserConnections({
                filterBy: 'acceptingUserId',
                query: user.details.id,
                itemsPerPage: 50,
                pageNumber: 1,
                orderBy: 'interactionCount',
                order: 'desc',
                shouldCheckReverse: true,
            // eslint-disable-next-line @typescript-eslint/no-empty-function
            }, user.details.id).catch(() => {});
        }
    };

    fetchBusinessData = () => {
        const { userId } = this.state;

        this.setState({ isBusinessDataLoading: true });

        const spacesPromise = MapsService.searchSpaces(
            {
                query: 'user',
                itemsPerPage: 20,
                pageNumber: 1,
            },
            { targetUserId: userId } as any,
        ).then((response: any) => response?.data?.results || []).catch(() => []);

        const thoughtsPromise = UsersService.searchThoughts(
            {
                query: 'user',
                itemsPerPage: 10,
                pageNumber: 1,
            },
            { targetUserId: userId },
        ).then((response: any) => response?.data?.results || []).catch(() => []);

        Promise.all([spacesPromise, thoughtsPromise]).then(([spaces, thoughts]) => {
            // Collect events from spaces that have them
            const events: any[] = [];
            spaces.forEach((space: any) => {
                if (space.events?.length) {
                    space.events.forEach((event: any) => {
                        events.push({
                            ...event,
                            spaceName: space.notificationMsg || space.message,
                        });
                    });
                }
            });
            // Sort events by start date
            events.sort((a, b) => {
                const dateA = new Date(a.scheduleStartAt || 0).getTime();
                const dateB = new Date(b.scheduleStartAt || 0).getTime();
                return dateA - dateB;
            });

            this.setState({
                userSpaces: spaces,
                userEvents: events,
                userThoughts: thoughts,
                isBusinessDataLoading: false,
            });
        }).catch(() => {
            this.setState({ isBusinessDataLoading: false });
        });
    };

    fetchUserThoughts = () => {
        const { userId } = this.state;

        UsersService.searchThoughts(
            {
                query: 'user',
                itemsPerPage: 5,
                pageNumber: 1,
            },
            { targetUserId: userId },
        ).then((response: any) => {
            this.setState({
                userThoughts: response?.data?.results || [],
            });
        }).catch(() => {
            // Silently fail - thoughts section just won't show
        });
    };

    getConnectionDetails = () => {
        const { user, userConnections } = this.props;
        const { userId } = this.state;

        const connection = userConnections.connections.find(
            (conn: any) => conn.users && conn.users.some((u: any) => u.id === userId),
        );

        if (!connection) return null;

        return connection.users.find((u: any) => u.id !== user.details.id);
    };

    handleChatClick = (e: any) => {
        const { onInitMessaging, user } = this.props;

        if (!user.isAuthenticated) {
            this.props.navigation.navigate('/login');
            return;
        }

        e.stopPropagation();

        const connectionDetails = this.getConnectionDetails();
        if (connectionDetails && onInitMessaging) {
            onInitMessaging(e, connectionDetails, 'view-user');
        }
    };

    handleSpaceClick = (spaceId: string) => {
        this.props.navigation.navigate(`/spaces/${spaceId}`);
    };

    handleThoughtClick = (thoughtId: string) => {
        this.props.navigation.navigate(`/thoughts/${thoughtId}`);
    };

    renderSkeleton(): JSX.Element {
        return (
            <Container id="page_view_user" size="lg" py="xl">
                <Stack gap="md">
                    <Skeleton height={16} width="30%" />
                    <Group gap="lg">
                        <Skeleton height={120} width={120} circle />
                        <Stack gap="xs" style={{ flex: 1 }}>
                            <Skeleton height={32} width="50%" />
                            <Skeleton height={20} width="30%" />
                        </Stack>
                    </Group>
                    <Skeleton height={1} />
                    <Skeleton height={80} />
                </Stack>
            </Container>
        );
    }

    renderBreadcrumbs(userInView: any): JSX.Element {
        const displayName = userInView.isBusinessAccount
            ? userInView.firstName
            : `${userInView.firstName} ${userInView.lastName}`;
        const items = [
            <Anchor href="/" key="home">{this.props.translate('pages.navigation.home')}</Anchor>,
            <Text key="users" component="span">{this.props.translate('pages.navigation.users')}</Text>,
            <Text key="name" component="span">{displayName}</Text>,
        ];

        return <Breadcrumbs className="user-breadcrumbs">{items}</Breadcrumbs>;
    }

    renderSocialLinks(userInView: any): JSX.Element | null {
        const socials = [
            { key: 'tiktok', label: 'TikTok', link: userInView?.socialSyncs?.tiktok?.link },
            { key: 'twitter', label: 'Twitter', link: userInView?.socialSyncs?.twitter?.link },
            { key: 'youtube', label: 'YouTube', link: userInView?.socialSyncs?.youtube?.link },
            { key: 'instagram', label: 'Instagram', link: userInView?.socialSyncs?.instagram?.link },
        ].filter((s) => !!s.link);

        if (socials.length === 0) return null;

        return (
            <Group gap="sm" mt="xs" wrap="wrap">
                {socials.map((social) => (
                    <Anchor key={social.key} href={social.link} target="_blank" size="sm">
                        {social.label}
                    </Anchor>
                ))}
            </Group>
        );
    }

    renderBusinessProfile(userInView: any): JSX.Element {
        const { user } = this.props;
        const {
            userSpaces, userEvents, userThoughts, isBusinessDataLoading,
        } = this.state;

        const isOwnProfile = user.isAuthenticated && user.details?.id === userInView.id;
        const isConnected = !isOwnProfile && !!this.getConnectionDetails();
        const showChatButton = !isOwnProfile && (isConnected || !user.isAuthenticated);
        const userImageUri = getUserImageUri({ details: userInView }, 480);

        return (
            <Container id="page_view_user" className="business-profile" size="lg" py="xl">
                <Stack gap="lg">
                    {this.renderBreadcrumbs(userInView)}

                    {/* Business Header */}
                    <Group gap="lg" align="flex-start" className="user-profile-header" wrap="wrap">
                        <Avatar
                            src={userImageUri}
                            alt={userInView.firstName}
                            size={120}
                            radius="50%"
                            className="user-avatar"
                        />
                        <Stack gap="xs" style={{ flex: 1, minWidth: 200 }}>
                            <Title order={1}>{userInView.firstName}</Title>
                            {userInView.userName && (
                                <Text size="lg" c="dimmed">@{userInView.userName}</Text>
                            )}
                            {userInView.settingsBio && (
                                <Text size="sm" style={{ whiteSpace: 'pre-wrap' }}>{userInView.settingsBio}</Text>
                            )}
                            {this.renderSocialLinks(userInView)}
                            <Group mt="xs" gap="sm">
                                {showChatButton && (
                                    <Button variant="filled" onClick={this.handleChatClick}>
                                        {this.props.translate('pages.viewUser.buttons.chat')}
                                    </Button>
                                )}
                            </Group>
                        </Stack>
                    </Group>

                    <Divider />

                    {/* Spaces Section - Hero Content */}
                    <div className="business-spaces-section">
                        <Title order={2} size="h3" mb="md">
                            {this.props.translate('pages.viewUser.headings.locations')}
                        </Title>
                        {isBusinessDataLoading && (
                            <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} spacing="md">
                                {[1, 2, 3].map((i) => <Skeleton key={i} height={240} radius="md" />)}
                            </SimpleGrid>
                        )}
                        {!isBusinessDataLoading && userSpaces.length === 0 && (
                            <Text c="dimmed" fs="italic">{this.props.translate('pages.viewUser.labels.noLocations')}</Text>
                        )}
                        {!isBusinessDataLoading && userSpaces.length > 0 && (
                            <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} spacing="md">
                                {userSpaces.map((space: any) => (
                                    <BusinessSpaceCard
                                        key={space.id}
                                        space={space}
                                        translate={this.props.translate}
                                        onSpaceClick={this.handleSpaceClick}
                                    />
                                ))}
                            </SimpleGrid>
                        )}
                    </div>

                    {/* Events Section */}
                    {(isBusinessDataLoading || userEvents.length > 0) && (
                        <>
                            <Divider />
                            <div className="business-events-section">
                                <Title order={2} size="h3" mb="md">
                                    {this.props.translate('pages.viewUser.headings.upcomingEvents')}
                                </Title>
                                {isBusinessDataLoading && (
                                    <Stack gap="sm">
                                        {[1, 2].map((i) => <Skeleton key={i} height={80} radius="md" />)}
                                    </Stack>
                                )}
                                {!isBusinessDataLoading && (
                                    <Stack gap="sm">
                                        {userEvents.slice(0, 4).map((event: any) => (
                                            <BusinessEventCard
                                                key={event.id}
                                                event={event}
                                                spaceName={event.spaceName}
                                            />
                                        ))}
                                    </Stack>
                                )}
                            </div>
                        </>
                    )}

                    {/* Updates Section (Thoughts) */}
                    {(isBusinessDataLoading || userThoughts.length > 0) && (
                        <>
                            <Divider />
                            <div className="business-updates-section">
                                <Title order={2} size="h3" mb="md">
                                    {this.props.translate('pages.viewUser.headings.latestUpdates')}
                                </Title>
                                {isBusinessDataLoading && (
                                    <Stack gap="sm">
                                        {[1, 2].map((i) => <Skeleton key={i} height={100} radius="md" />)}
                                    </Stack>
                                )}
                                {!isBusinessDataLoading && (
                                    <Stack gap="sm">
                                        {userThoughts.slice(0, 5).map((thought: any) => (
                                            <BusinessUpdateCard
                                                key={thought.id}
                                                thought={thought}
                                                onThoughtClick={this.handleThoughtClick}
                                            />
                                        ))}
                                    </Stack>
                                )}
                            </div>
                        </>
                    )}
                </Stack>
            </Container>
        );
    }

    renderPersonalProfile(userInView: any): JSX.Element {
        const { user } = this.props;
        const { userThoughts } = this.state;

        const isOwnProfile = user.isAuthenticated && user.details?.id === userInView.id;
        const isConnected = !isOwnProfile && !!this.getConnectionDetails();
        const showChatButton = !isOwnProfile && (isConnected || !user.isAuthenticated);

        const userImageUri = getUserImageUri({ details: userInView }, 480);
        const fullName = `${userInView.firstName} ${userInView.lastName}`;

        return (
            <Container id="page_view_user" size="lg" py="xl">
                <Stack gap="md">
                    {this.renderBreadcrumbs(userInView)}

                    {/* Profile Header */}
                    <Group gap="lg" align="flex-start" className="user-profile-header" wrap="wrap">
                        <Avatar
                            src={userImageUri}
                            alt={fullName}
                            size={120}
                            radius="50%"
                            className="user-avatar"
                        />
                        <Stack gap="xs" style={{ flex: 1, minWidth: 200 }}>
                            <Title order={1}>{fullName}</Title>
                            {userInView.userName && (
                                <Text size="lg" c="dimmed">@{userInView.userName}</Text>
                            )}
                            {this.renderSocialLinks(userInView)}
                            {showChatButton && (
                                <Group mt="xs">
                                    <Button
                                        variant="filled"
                                        onClick={this.handleChatClick}
                                    >
                                        {this.props.translate('pages.viewUser.buttons.chat')}
                                    </Button>
                                </Group>
                            )}
                        </Stack>
                    </Group>

                    <Divider />

                    {/* Bio */}
                    {userInView.settingsBio && (
                        <div className="user-bio">
                            <Title order={3} size="h4">{this.props.translate('pages.viewUser.headings.about')}</Title>
                            <Text mt="xs" style={{ whiteSpace: 'pre-wrap' }}>{userInView.settingsBio}</Text>
                        </div>
                    )}

                    {/* Updates Section (Thoughts) */}
                    {userThoughts.length > 0 && (
                        <>
                            <Divider />
                            <div className="business-updates-section">
                                <Title order={2} size="h3" mb="md">
                                    {this.props.translate('pages.viewUser.headings.latestUpdates')}
                                </Title>
                                <Stack gap="sm">
                                    {userThoughts.slice(0, 5).map((thought: any) => (
                                        <BusinessUpdateCard
                                            key={thought.id}
                                            thought={thought}
                                            onThoughtClick={this.handleThoughtClick}
                                        />
                                    ))}
                                </Stack>
                            </div>
                        </>
                    )}
                </Stack>
            </Container>
        );
    }

    public render(): JSX.Element {
        const { user } = this.props;
        const userInView = user.userInView;

        if (!userInView) {
            return this.renderSkeleton();
        }

        if (userInView.isBusinessAccount) {
            return this.renderBusinessProfile(userInView);
        }

        return this.renderPersonalProfile(userInView);
    }
}

export default withNavigation(withTranslation(connect(mapStateToProps, mapDispatchToProps)(ViewUserComponent)));
