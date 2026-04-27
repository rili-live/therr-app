/* eslint-disable class-methods-use-this */
import * as React from 'react';
import { NavigateFunction } from 'react-router-dom';
import {
    Container, Stack, Title, Text, Avatar, Skeleton, Anchor, Divider, Box,
} from '@mantine/core';
import { UsersService } from 'therr-react/services';
import withNavigation from '../wrappers/withNavigation';
import withTranslation from '../wrappers/withTranslation';
import getUserImageUri from '../utilities/getUserImageUri';

interface IPublicProfileRouterProps {
    navigation: { navigate: NavigateFunction };
    routeParams: { userName: string };
}

interface IPublicProfileProps extends IPublicProfileRouterProps {
    translate: (key: string, params?: any) => string;
}

interface IPublicProfileState {
    userInView: any | null;
    isLoading: boolean;
    notFound: boolean;
}

const HABITS_PROFILE_BASE_URL = 'https://habits.therr.com/u';

export class PublicProfileComponent extends React.Component<IPublicProfileProps, IPublicProfileState> {
    constructor(props: IPublicProfileProps) {
        super(props);
        this.state = {
            userInView: null,
            isLoading: true,
            notFound: false,
        };
    }

    componentDidMount() {
        this.fetchUser();
    }

    componentDidUpdate(prevProps: IPublicProfileProps) {
        if (prevProps.routeParams.userName !== this.props.routeParams.userName) {
            this.setState({ userInView: null, isLoading: true, notFound: false }, () => {
                this.fetchUser();
            });
        }
    }

    fetchUser = () => {
        const { userName } = this.props.routeParams;
        if (!userName) {
            this.setState({ isLoading: false, notFound: true });
            return;
        }
        UsersService.getByUserName(userName)
            .then((response: any) => {
                const userInView = response?.data;
                if (!userInView || !userInView.userName) {
                    this.setState({ isLoading: false, notFound: true });
                    return;
                }
                const displayName = userInView.isBusinessAccount
                    ? userInView.firstName
                    : `${userInView.firstName || ''} ${userInView.lastName || ''}`.trim();
                document.title = `${displayName || userInView.userName} | Therr`;
                this.setState({ userInView, isLoading: false, notFound: false });
            })
            .catch(() => {
                this.setState({ isLoading: false, notFound: true });
            });
    };

    renderSkeleton(): JSX.Element {
        return (
            <Container id="page_public_profile" size="sm" py="xl">
                <Stack gap="md" align="center">
                    <Skeleton height={144} circle />
                    <Skeleton height={28} width="60%" />
                    <Skeleton height={18} width="30%" />
                    <Skeleton height={60} width="100%" mt="md" />
                </Stack>
            </Container>
        );
    }

    renderNotFound(): JSX.Element {
        const { translate, routeParams } = this.props;
        return (
            <Container id="page_public_profile" size="sm" py="xl">
                <Stack gap="sm" align="center">
                    <Title order={1} size="h2">
                        {translate('pages.publicProfile.notFound.title')}
                    </Title>
                    <Text c="dimmed">
                        {translate('pages.publicProfile.notFound.message', { userName: routeParams.userName })}
                    </Text>
                    <Anchor href="/">{translate('pages.publicProfile.notFound.backHome')}</Anchor>
                </Stack>
            </Container>
        );
    }

    render(): JSX.Element {
        const { isLoading, notFound, userInView } = this.state;
        const { translate } = this.props;

        if (isLoading) return this.renderSkeleton();
        if (notFound || !userInView) return this.renderNotFound();

        const displayName = userInView.isBusinessAccount
            ? userInView.firstName
            : `${userInView.firstName || ''} ${userInView.lastName || ''}`.trim();
        const fallbackName = displayName || userInView.userName;
        const avatarUri = getUserImageUri({ details: userInView }, 480);
        const habitsProfileUrl = `${HABITS_PROFILE_BASE_URL}/${encodeURIComponent(userInView.userName)}`;

        return (
            <Container id="page_public_profile" size="sm" py="xl">
                <Stack gap="md" align="center">
                    <Avatar
                        src={avatarUri}
                        alt={fallbackName}
                        size={144}
                        radius="50%"
                    />
                    <Stack gap={4} align="center">
                        <Title order={1} size="h2" ta="center">{fallbackName}</Title>
                        {userInView.userName && (
                            <Text size="md" c="dimmed">@{userInView.userName}</Text>
                        )}
                    </Stack>
                    {userInView.settingsBio && (
                        <Text ta="center" style={{ whiteSpace: 'pre-wrap', maxWidth: 540 }}>
                            {userInView.settingsBio}
                        </Text>
                    )}

                    <Divider w="100%" my="md" />

                    <Box ta="center">
                        <Text size="xs" tt="uppercase" c="dimmed" mb="xs" style={{ letterSpacing: '0.08em' }}>
                            {translate('pages.publicProfile.crossPromo.label')}
                        </Text>
                        <Anchor
                            href={habitsProfileUrl}
                            rel="noopener"
                            style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 10,
                                padding: '12px 22px',
                                background: '#fff8f3',
                                color: '#102a43',
                                fontWeight: 600,
                                borderRadius: 999,
                                border: '1px solid #d9e2ec',
                                textDecoration: 'none',
                            }}
                        >
                            <span
                                aria-hidden="true"
                                style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    width: 24,
                                    height: 24,
                                    borderRadius: '50%',
                                    background: '#ff6b35',
                                    color: '#fff',
                                    fontWeight: 800,
                                    fontSize: 14,
                                    lineHeight: 1,
                                }}
                            >
                                H
                            </span>
                            <span>{translate('pages.publicProfile.crossPromo.habitsCta')}</span>
                        </Anchor>
                    </Box>
                </Stack>
            </Container>
        );
    }
}

export default withNavigation(withTranslation(PublicProfileComponent));
