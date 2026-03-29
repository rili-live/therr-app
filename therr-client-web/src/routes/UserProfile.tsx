import * as React from 'react';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import { NavigateFunction } from 'react-router-dom';
import { UserConnectionsActions } from 'therr-react/redux/actions';
import { IUserState, IUserConnectionsState } from 'therr-react/types';
import { MantineButton } from 'therr-react/components/mantine';
import { MapsService, UsersService } from 'therr-react/services';
import {
    Avatar,
    Button,
    Card,
    Container,
    Divider,
    Group,
    SimpleGrid,
    Skeleton,
    Stack,
    Text,
    Title,
    Tooltip,
    UnstyledButton,
} from '@mantine/core';
import CreateConnectionForm from '../components/forms/CreateConnectionForm';
import getUserImageUri from '../utilities/getUserImageUri';
import withNavigation from '../wrappers/withNavigation';
import withTranslation from '../wrappers/withTranslation';
import BusinessSpaceCard from '../components/business-profile/BusinessSpaceCard';
import BusinessEventCard from '../components/business-profile/BusinessEventCard';
import ThoughtCard from '../components/business-profile/ThoughtCard';

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
    translate: (key: string, params?: any) => string;
}

interface IUserProfileState {
    mySpaces: any[];
    myEvents: any[];
    myThoughts: any[];
    isBusinessDataLoading: boolean;
    isThoughtsLoading: boolean;
}

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
    constructor(props: IUserProfileProps) {
        super(props);

        this.state = {
            mySpaces: [],
            myEvents: [],
            myThoughts: [],
            isBusinessDataLoading: false,
            isThoughtsLoading: false,
        };
    }

    componentDidMount() {
        const {
            user,
            userConnections,
        } = this.props;
        if (!user.details) return;

        document.title = `Therr | ${this.props.translate('pages.userProfile.pageTitle')} | ${user.details.userName}`;
        if (!userConnections.connections.length) {
            this.props.searchUserConnections({
                filterBy: 'acceptingUserId',
                query: user.details.id,
                itemsPerPage: 50,
                pageNumber: 1,
                orderBy: 'interactionCount',
                order: 'desc',
                shouldCheckReverse: true,
            }, user.details.id).catch((err: any) => console.log(err));
        }

        if (user.details.isBusinessAccount) {
            this.fetchBusinessData();
        } else {
            this.fetchThoughts();
        }
    }

    fetchBusinessData = () => {
        this.setState({ isBusinessDataLoading: true });

        const spacesPromise = MapsService.searchSpaces(
            {
                query: 'me',
                itemsPerPage: 20,
                pageNumber: 1,
            },
        ).then((response: any) => response?.data?.results || []).catch(() => []);

        const thoughtsPromise = UsersService.searchThoughts(
            {
                query: 'me',
                itemsPerPage: 10,
                pageNumber: 1,
            },
        ).then((response: any) => response?.data?.results || []).catch(() => []);

        Promise.all([spacesPromise, thoughtsPromise]).then(([spaces, thoughts]) => {
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
            events.sort((a, b) => {
                const dateA = new Date(a.scheduleStartAt || 0).getTime();
                const dateB = new Date(b.scheduleStartAt || 0).getTime();
                return dateA - dateB;
            });

            this.setState({
                mySpaces: spaces,
                myEvents: events,
                myThoughts: thoughts,
                isBusinessDataLoading: false,
            });
        }).catch(() => {
            this.setState({ isBusinessDataLoading: false });
        });
    };

    fetchThoughts = () => {
        this.setState({ isThoughtsLoading: true });

        UsersService.searchThoughts({
            query: 'me',
            itemsPerPage: 5,
            pageNumber: 1,
        }).then((response: any) => {
            this.setState({
                myThoughts: response?.data?.results || [],
                isThoughtsLoading: false,
            });
        }).catch(() => {
            this.setState({ isThoughtsLoading: false });
        });
    };

    getConnectionDetails = (connection: any) => {
        const { user } = this.props;

        return connection.users.find((u: any) => u.id !== user.details.id);
    };

    handleConnectionClick = (connection: any) => {
        const connectionDetails = this.getConnectionDetails(connection);
        if (connectionDetails?.id) {
            this.props.navigation.navigate(`/users/${connectionDetails.id}`);
        }
    };

    handleSpaceClick = (spaceId: string) => {
        this.props.navigation.navigate(`/spaces/${spaceId}`);
    };

    handleEditSpaceClick = (spaceId: string) => {
        this.props.navigation.navigate(`/spaces/${spaceId}/edit`);
    };

    handleThoughtClick = (thoughtId: string) => {
        this.props.navigation.navigate(`/thoughts/${thoughtId}`);
    };

    onCreateForumClick = () => {
        this.props.navigation.navigate('/create-forum');
    };

    renderSkeleton(): JSX.Element { // eslint-disable-line class-methods-use-this
        return (
            <Container id="page_user_profile" size="sm" py="xl">
                <Stack align="center" gap="md">
                    <Skeleton height={120} circle />
                    <Skeleton height={28} width="40%" />
                    <Skeleton height={18} width="30%" />
                </Stack>
                <Skeleton height={200} radius="md" mt="xl" />
                <Skeleton height={150} radius="md" mt="md" />
            </Container>
        );
    }

    renderDetailRow(label: string, value: string): JSX.Element { // eslint-disable-line class-methods-use-this
        return (
            <Group justify="space-between" wrap="nowrap">
                <Text size="sm" c="dimmed" fw={500}>{label}</Text>
                <Text size="sm" ta="right" style={{ wordBreak: 'break-word' }}>{value || '—'}</Text>
            </Group>
        );
    }

    onEditProfileClick = () => {
        this.props.navigation.navigate('/user/edit-profile');
    };

    onCreateSpaceClick = () => {
        this.props.navigation.navigate('/spaces/manage');
    };

    renderBusinessProfile(): JSX.Element {
        const { createUserConnection, user, userConnections } = this.props;
        const {
            mySpaces, myEvents, myThoughts, isBusinessDataLoading,
        } = this.state;

        const userImageUri = getUserImageUri(user, 120);

        return (
            <div id="page_user_profile" className="business-profile">
                <Container size="lg" py="xl">
                    <Stack gap="lg">
                        {/* Business Header */}
                        <Group gap="lg" align="flex-start" wrap="wrap">
                            <Avatar
                                src={userImageUri}
                                alt={user.details.firstName}
                                size={120}
                                radius="50%"
                                className="user-avatar"
                            />
                            <Stack gap="xs" style={{ flex: 1, minWidth: 200 }}>
                                <Title order={1}>{user.details.firstName}</Title>
                                <Text size="lg" c="dimmed">@{user.details.userName}</Text>
                            </Stack>
                        </Group>

                        {/* Action Buttons */}
                        <Group gap="sm">
                            <MantineButton
                                id="edit_profile_button"
                                text={this.props.translate('pages.userProfile.buttons.editProfile')}
                                onClick={this.onEditProfileClick}
                                variant="light"
                                size="sm"
                            />
                            <MantineButton
                                id="manage_spaces_button"
                                text={this.props.translate('pages.userProfile.buttons.manageSpaces')}
                                onClick={this.onCreateSpaceClick}
                                variant="light"
                                size="sm"
                            />
                        </Group>

                        <Divider />

                        {/* My Locations */}
                        <div className="business-spaces-section">
                            <Title order={2} size="h3" mb="md">
                                {this.props.translate('pages.userProfile.h2.myLocations')}
                            </Title>
                            {isBusinessDataLoading && (
                                <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} spacing="md">
                                    {[1, 2, 3].map((i) => <Skeleton key={i} height={240} radius="md" />)}
                                </SimpleGrid>
                            )}
                            {!isBusinessDataLoading && mySpaces.length === 0 && (
                                <Text c="dimmed" fs="italic">
                                    {this.props.translate('pages.userProfile.labels.noLocations')}
                                </Text>
                            )}
                            {!isBusinessDataLoading && mySpaces.length > 0 && (
                                <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} spacing="md">
                                    {mySpaces.map((space: any) => (
                                        <BusinessSpaceCard
                                            key={space.id}
                                            space={space}
                                            translate={this.props.translate}
                                            onSpaceClick={this.handleSpaceClick}
                                            onEditClick={this.handleEditSpaceClick}
                                        />
                                    ))}
                                </SimpleGrid>
                            )}
                        </div>

                        {/* My Events */}
                        {(isBusinessDataLoading || myEvents.length > 0) && (
                            <>
                                <Divider />
                                <div className="business-events-section">
                                    <Title order={2} size="h3" mb="md">
                                        {this.props.translate('pages.userProfile.h2.myEvents')}
                                    </Title>
                                    {isBusinessDataLoading && (
                                        <Stack gap="sm">
                                            {[1, 2].map((i) => <Skeleton key={i} height={80} radius="md" />)}
                                        </Stack>
                                    )}
                                    {!isBusinessDataLoading && (
                                        <Stack gap="sm">
                                            {myEvents.slice(0, 4).map((event: any) => (
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

                        {/* My Updates */}
                        {(isBusinessDataLoading || myThoughts.length > 0) && (
                            <>
                                <Divider />
                                <div className="updates-section">
                                    <Title order={2} size="h3" mb="md">
                                        {this.props.translate('pages.userProfile.h2.myUpdates')}
                                    </Title>
                                    {isBusinessDataLoading && (
                                        <Stack gap="sm">
                                            {[1, 2].map((i) => <Skeleton key={i} height={100} radius="md" />)}
                                        </Stack>
                                    )}
                                    {!isBusinessDataLoading && (
                                        <Stack gap="sm">
                                            {myThoughts.slice(0, 5).map((thought: any) => (
                                                <ThoughtCard key={thought.id} thought={thought} onThoughtClick={this.handleThoughtClick} />
                                            ))}
                                        </Stack>
                                    )}
                                </div>
                            </>
                        )}

                        {/* Connections */}
                        <Divider />
                        <div className="business-connections-section">
                            <Title order={2} size="h3" mb="md">
                                {this.props.translate('pages.userProfile.h2.connections')}
                            </Title>
                            <div id="user-connections-container" className="user-connections-container">
                                {
                                    userConnections.connections.length
                                        ? userConnections.connections.slice(0, 10).map((connection: any) => {
                                            const connectionDetails = this.getConnectionDetails(connection);
                                            if (!connectionDetails) return null;

                                            return (
                                                <div className="user-connection-icon" key={connectionDetails.id}>
                                                    {
                                                        connection.users
                                                        && <span className="name-tag">{connectionDetails.firstName}</span>
                                                    }
                                                    <img
                                                        src={getUserImageUri({ details: connectionDetails }, 100)}
                                                        alt="User Connection"
                                                        width="100"
                                                        height="100"
                                                        loading="lazy"
                                                        onClick={() => this.handleConnectionClick(connection)}
                                                    />
                                                </div>
                                            );
                                        })
                                        : <Text c="dimmed" fs="italic">{this.props.translate('pages.userProfile.requestRecommendation')}</Text>
                                }
                            </div>
                        </div>

                        {/* Add Connection */}
                        <div id="add_connections">
                            <Title order={2} size="h3" mb="md">
                                {this.props.translate('pages.userProfile.h2.addConnection')}
                            </Title>
                            <CreateConnectionForm
                                createUserConnection={createUserConnection}
                                user={user}
                            />
                        </div>
                    </Stack>
                </Container>
            </div>
        );
    }

    public render(): JSX.Element | null {
        const { createUserConnection, user, userConnections } = this.props;
        const { myThoughts, isThoughtsLoading } = this.state;

        if (!user.details) {
            return this.renderSkeleton();
        }

        if (user.details.isBusinessAccount) {
            return this.renderBusinessProfile();
        }

        const profileImageUri = getUserImageUri(user, 200);
        const userInitial = (user.details.firstName || user.details.userName || '?').charAt(0).toUpperCase();

        return (
            <Container id="page_user_profile" size="sm" py="xl">
                <Stack gap="lg">
                    {/* Profile Header */}
                    <Stack align="center" gap="sm">
                        <Avatar
                            src={profileImageUri}
                            alt={user.details.userName}
                            size={120}
                            radius={120}
                            color="teal"
                        >
                            {userInitial}
                        </Avatar>
                        <Title order={2}>{user.details.userName}</Title>
                        {(user.details.firstName || user.details.lastName) && (
                            <Text c="dimmed">
                                {[user.details.firstName, user.details.lastName].filter(Boolean).join(' ')}
                            </Text>
                        )}
                    </Stack>

                    {/* Account Details */}
                    <Card withBorder radius="md" p="lg">
                        <Title order={4} mb="md">{this.props.translate('pages.userProfile.h2.accountDetails')}</Title>
                        <Stack gap="sm">
                            {this.renderDetailRow(this.props.translate('pages.userProfile.labels.firstName'), user.details.firstName)}
                            <Divider variant="dashed" />
                            {this.renderDetailRow(this.props.translate('pages.userProfile.labels.lastName'), user.details.lastName)}
                            <Divider variant="dashed" />
                            {this.renderDetailRow(this.props.translate('pages.userProfile.labels.userName'), user.details.userName)}
                            <Divider variant="dashed" />
                            {this.renderDetailRow(this.props.translate('pages.userProfile.labels.email'), user.details.email)}
                            <Divider variant="dashed" />
                            {this.renderDetailRow(this.props.translate('pages.userProfile.labels.phone'), user.details.phoneNumber)}
                        </Stack>
                        <Group justify="flex-end" mt="md">
                            <Button
                                variant="subtle"
                                size="sm"
                                onClick={this.onEditProfileClick}
                            >
                                {this.props.translate('pages.userProfile.buttons.editProfile')}
                            </Button>
                            <Button
                                variant="subtle"
                                size="sm"
                                onClick={() => this.props.navigation.navigate('/users/change-password')}
                            >
                                {this.props.translate('pages.userProfile.buttons.changePassword')}
                            </Button>
                        </Group>
                    </Card>

                    {/* Recent Thoughts / Updates */}
                    <Card withBorder radius="md" p="lg">
                        <Title order={4} mb="md">{this.props.translate('pages.userProfile.h2.myUpdates')}</Title>
                        {isThoughtsLoading && (
                            <Stack gap="sm">
                                {[1, 2].map((i) => <Skeleton key={i} height={80} radius="md" />)}
                            </Stack>
                        )}
                        {!isThoughtsLoading && myThoughts.length === 0 && (
                            <Text size="sm" c="dimmed" fs="italic">
                                {this.props.translate('pages.userProfile.labels.noUpdates')}
                            </Text>
                        )}
                        {!isThoughtsLoading && myThoughts.length > 0 && (
                            <Stack gap="sm">
                                {myThoughts.map((thought: any) => (
                                    <ThoughtCard key={thought.id} thought={thought} onThoughtClick={this.handleThoughtClick} />
                                ))}
                            </Stack>
                        )}
                    </Card>

                    {/* Connections */}
                    <Card withBorder radius="md" p="lg">
                        <Group justify="space-between" mb="md">
                            <Title order={4}>{this.props.translate('pages.userProfile.h2.connections')}</Title>
                            <MantineButton
                                text={this.props.translate('pages.userProfile.buttons.createAForum')}
                                onClick={this.onCreateForumClick}
                                variant="light"
                                size="xs"
                            />
                        </Group>
                        {userConnections.connections.length > 0 ? (
                            <SimpleGrid cols={{
                                base: 3, xs: 4, sm: 5, md: 6,
                            }} spacing="md" verticalSpacing="lg">
                                {userConnections.connections.map((connection: any) => {
                                    const connectionDetails = this.getConnectionDetails(connection);
                                    if (!connectionDetails) return null;
                                    const connImageUri = getUserImageUri({ details: connectionDetails }, 100);
                                    const connInitial = (connectionDetails.firstName || '?').charAt(0).toUpperCase();

                                    return (
                                        <Tooltip label={connectionDetails.firstName} key={connectionDetails.id}>
                                            <UnstyledButton
                                                onClick={() => this.handleConnectionClick(connection)}
                                                style={{ overflow: 'hidden', width: '100%' }}
                                            >
                                                <Stack align="center" gap={6}>
                                                    <Avatar
                                                        src={connImageUri}
                                                        alt={connectionDetails.firstName}
                                                        size={64}
                                                        radius={64}
                                                        color="teal"
                                                    >
                                                        {connInitial}
                                                    </Avatar>
                                                    <Text size="xs" lineClamp={1} ta="center" style={{ maxWidth: '100%' }}>
                                                        {connectionDetails.firstName}
                                                    </Text>
                                                </Stack>
                                            </UnstyledButton>
                                        </Tooltip>
                                    );
                                })}
                            </SimpleGrid>
                        ) : (
                            <Text size="sm" c="dimmed" fs="italic">
                                {this.props.translate('pages.userProfile.requestRecommendation')}
                            </Text>
                        )}
                    </Card>

                    {/* Add Connection */}
                    <Card withBorder radius="md" p="lg">
                        <Title order={4} mb="md">{this.props.translate('pages.userProfile.h2.addConnection')}</Title>
                        <CreateConnectionForm
                            createUserConnection={createUserConnection}
                            user={user}
                        />
                    </Card>
                </Stack>
            </Container>
        );
    }
}

export default withNavigation(withTranslation(connect(mapStateToProps, mapDispatchToProps)(UserProfileComponent)));
