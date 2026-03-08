/* eslint-disable max-len, react/jsx-no-target-blank, class-methods-use-this */
import * as React from 'react';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import { NavigateFunction } from 'react-router-dom';
import { IContentState, IUserState } from 'therr-react/types';
import {
    Container, Stack, Group, Title, Text, Anchor,
    Divider, Avatar, Skeleton, Breadcrumbs,
} from '@mantine/core';
import translator from '../services/translator';
import UsersActions from '../redux/actions/UsersActions';
import withNavigation from '../wrappers/withNavigation';
import getUserImageUri from '../utilities/getUserImageUri';

interface IViewUserRouterProps {
    navigation: {
        navigate: NavigateFunction;
    };
    routeParams: {
        userId: string;
    }
}

interface IViewUserDispatchProps {
    login: Function;
    getUser: Function;
}

interface IStoreProps extends IViewUserDispatchProps {
    content: IContentState;
    user: IUserState;
}

// Regular component props
interface IViewUserProps extends IViewUserRouterProps, IStoreProps {
}

interface IViewUserState {
    userId: string;
}

const mapStateToProps = (state: any) => ({
    content: state.content,
    user: state.user,
});

const mapDispatchToProps = (dispatch: any) => bindActionCreators({
    getUser: UsersActions.get,
}, dispatch);

/**
 * ViewUser
 */
export class ViewUserComponent extends React.Component<IViewUserProps, IViewUserState> {
    private translate: Function;

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
        };

        this.translate = (key: string, params: any) => translator('en-us', key, params);
    }

    componentDidMount() { // eslint-disable-line class-methods-use-this
        const { getUser, user } = this.props;
        const userInView = user.userInView;

        if (!userInView) {
            getUser(this.state.userId).then((fetchedUser) => {
                document.title = `${fetchedUser?.firstName} ${fetchedUser?.lastName} | Therr App`;
            }).catch(() => {
                this.props.navigation.navigate('/');
            });
        } else {
            document.title = `${userInView.firstName} ${userInView?.lastName} | Therr App`;
        }
    }

    login = (credentials: any) => this.props.login(credentials);

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
        const fullName = `${userInView.firstName} ${userInView.lastName}`;
        const items = [
            <Anchor href="/" key="home">Home</Anchor>,
            <Text key="users" component="span">Users</Text>,
            <Text key="name" component="span">{fullName}</Text>,
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

    public render(): JSX.Element {
        const { user } = this.props;
        const userInView = user.userInView;

        if (!userInView) {
            return this.renderSkeleton();
        }

        const userImageUri = getUserImageUri({ details: userInView }, 480);
        const fullName = `${userInView.firstName} ${userInView.lastName}`;

        return (
            <Container id="page_view_user" size="lg" py="xl">
                <Stack gap="md">
                    {/* Breadcrumbs */}
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
                        </Stack>
                    </Group>

                    <Divider />

                    {/* Bio */}
                    {userInView.settingsBio && (
                        <div className="user-bio">
                            <Title order={3} size="h4">About</Title>
                            <Text mt="xs" style={{ whiteSpace: 'pre-wrap' }}>{userInView.settingsBio}</Text>
                        </div>
                    )}
                </Stack>
            </Container>
        );
    }
}

export default withNavigation(connect(mapStateToProps, mapDispatchToProps)(ViewUserComponent));
