import * as React from 'react';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import { NavigateFunction } from 'react-router-dom';
import { UserConnectionsActions } from 'therr-react/redux/actions';
import { IUserState, IUserConnectionsState } from 'therr-react/types';
import { MantineButton } from 'therr-react/components/mantine';
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
    constructor(props: IUserProfileProps) {
        super(props);

        this.state = {};
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
            }, user.details.id).catch((err) => console.log(err));
        }
    }

    getConnectionDetails = (connection) => {
        const { user } = this.props;

        return connection.users.find((u) => u.id !== user.details.id);
    };

    handleConnectionClick = (connection) => {
        const connectionDetails = this.getConnectionDetails(connection);
        if (connectionDetails) {
            this.props.navigation.navigate(`/users/${connectionDetails.id}`);
        }
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

    public render(): JSX.Element | null {
        const { createUserConnection, user, userConnections } = this.props;

        if (!user.details) {
            return this.renderSkeleton();
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
                                onClick={() => this.props.navigation.navigate('/users/change-password')}
                            >
                                {this.props.translate('pages.userProfile.buttons.changePassword')}
                            </Button>
                        </Group>
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
                            <SimpleGrid cols={{ base: 4, sm: 6, md: 8 }} spacing="sm">
                                {userConnections.connections.map((connection: any) => {
                                    const connectionDetails = this.getConnectionDetails(connection);
                                    if (!connectionDetails) return null;
                                    const connImageUri = getUserImageUri({ details: connectionDetails }, 100);
                                    const connInitial = (connectionDetails.firstName || '?').charAt(0).toUpperCase();

                                    return (
                                        <Tooltip label={connectionDetails.firstName} key={connectionDetails.id}>
                                            <UnstyledButton onClick={() => this.handleConnectionClick(connection)}>
                                                <Stack align="center" gap={4}>
                                                    <Avatar
                                                        src={connImageUri}
                                                        alt={connectionDetails.firstName}
                                                        size={56}
                                                        radius={56}
                                                        color="teal"
                                                    >
                                                        {connInitial}
                                                    </Avatar>
                                                    <Text size="xs" lineClamp={1} ta="center">{connectionDetails.firstName}</Text>
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
