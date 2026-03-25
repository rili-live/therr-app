import * as React from 'react';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import { NavigateFunction } from 'react-router-dom';
import { UserConnectionsActions } from 'therr-react/redux/actions';
import { IUserState, IUserConnectionsState } from 'therr-react/types';
import { MantineButton } from 'therr-react/components/mantine';
import { MapsService, UsersService } from 'therr-react/services';
import {
    Container, Stack, Group, Title, Text, Avatar,
    Divider, SimpleGrid, Skeleton,
} from '@mantine/core';
import CreateConnectionForm from '../components/forms/CreateConnectionForm';
import getUserImageUri from '../utilities/getUserImageUri';
import withNavigation from '../wrappers/withNavigation';
import withTranslation from '../wrappers/withTranslation';
import BusinessSpaceCard from '../components/business-profile/BusinessSpaceCard';
import BusinessEventCard from '../components/business-profile/BusinessEventCard';
import BusinessUpdateCard from '../components/business-profile/BusinessUpdateCard';

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
        };
    }

    componentDidMount() {
        const {
            user,
            userConnections,
        } = this.props;
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
        });
    };

    getConnectionDetails = (connection: any) => {
        const { user } = this.props;

        return connection.users.find((u: any) => u.id !== user.details.id);
    };

    handleConnectionClick = (connection: any) => {
        const connectionDetails = this.getConnectionDetails(connection);
        this.props.navigation.navigate(`/users/${connectionDetails.id}`);
    };

    handleSpaceClick = (spaceId: string) => {
        this.props.navigation.navigate(`/spaces/${spaceId}`);
    };

    handleEditSpaceClick = (spaceId: string) => {
        this.props.navigation.navigate(`/spaces/${spaceId}/edit`);
    };

    onCreateForumClick = () => {
        this.props.navigation.navigate('/create-forum');
    };

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
                                <div className="business-updates-section">
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
                                                <BusinessUpdateCard key={thought.id} thought={thought} />
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

        if (!user.details) {
            return null;
        }

        if (user.details.isBusinessAccount) {
            return this.renderBusinessProfile();
        }

        return (
            <div id="page_user_profile" className="flex-box column">
                <div className="header-profile-picture">
                    <h1 className="fill text-left">{user.details.userName}</h1>
                    <div className="user-profile-icon">
                        <img
                            src={getUserImageUri(user, 100)}
                            alt="Profile Picture"
                            width="100"
                            height="100"
                        />
                    </div>
                </div>
                <div className="edit-profile-link">
                    <MantineButton
                        id="edit_profile_button"
                        text={this.props.translate('pages.userProfile.buttons.editProfile')}
                        onClick={this.onEditProfileClick}
                        variant="light"
                        size="sm"
                    />
                </div>
                <div className="flex-box account-sections">
                    <div id="account_details" className="account-section">
                        <h2 className="desktop-only block">{this.props.translate('pages.userProfile.h2.accountDetails')}</h2>
                        <div className="account-section-content">
                            <h4><label>{this.props.translate('pages.userProfile.labels.firstName')}:</label> {user.details.firstName}</h4>
                            <h4><label>{this.props.translate('pages.userProfile.labels.lastName')}:</label> {user.details.lastName}</h4>
                            <h4><label>{this.props.translate('pages.userProfile.labels.userName')}:</label> {user.details.userName}</h4>
                            <h4><label>{this.props.translate('pages.userProfile.labels.email')}:</label> {user.details.email}</h4>
                            <h4><label>{this.props.translate('pages.userProfile.labels.phone')}:</label> {user.details.phoneNumber}</h4>
                        </div>
                    </div>
                    <div id="your_connections" className="account-section">
                        <h2>{this.props.translate('pages.userProfile.h2.connections')}</h2>
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
                                    : <span><i>{this.props.translate('pages.userProfile.requestRecommendation')}</i></span>
                            }
                        </div>
                    </div>
                    <div id="add_connections" className="account-section">
                        <h2>{this.props.translate('pages.userProfile.h2.addConnection')}</h2>
                        <div className="account-content">
                            <CreateConnectionForm
                                createUserConnection={createUserConnection}
                                user={user}
                            />
                        </div>
                    </div>
                </div>
                <div className="fill text-right padding-sm">
                    <MantineButton
                        text={this.props.translate('pages.userProfile.buttons.createAForum')}
                        onClick={this.onCreateForumClick}
                    />
                </div>
            </div>
        );
    }
}

export default withNavigation(withTranslation(connect(mapStateToProps, mapDispatchToProps)(UserProfileComponent)));
