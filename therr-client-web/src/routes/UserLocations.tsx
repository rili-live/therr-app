import * as React from 'react';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import { NavigateFunction } from 'react-router-dom';
import { IUserState } from 'therr-react/types';
import { MapsService } from 'therr-react/services';
import {
    Anchor,
    Breadcrumbs,
    Container,
    SimpleGrid,
    Skeleton,
    Stack,
    Text,
    Title,
} from '@mantine/core';
import UsersActions from '../redux/actions/UsersActions';
import withNavigation from '../wrappers/withNavigation';
import withTranslation from '../wrappers/withTranslation';
import BusinessSpaceCard from '../components/business-profile/BusinessSpaceCard';

interface IUserLocationsRouterProps {
    navigation: {
        navigate: NavigateFunction;
    };
    routeParams: {
        userId: string;
    };
}

interface IUserLocationsDispatchProps {
    getUser: Function;
}

interface IStoreProps extends IUserLocationsDispatchProps {
    user: IUserState;
}

interface IUserLocationsProps extends IUserLocationsRouterProps, IStoreProps {
    translate: (key: string, params?: any) => string;
}

interface IUserLocationsState {
    userSpaces: any[];
    isLoading: boolean;
    userName: string;
}

const mapStateToProps = (state: any) => ({
    user: state.user,
});

const mapDispatchToProps = (dispatch: any) => bindActionCreators({
    getUser: UsersActions.get,
}, dispatch);

class UserLocationsComponent extends React.Component<IUserLocationsProps, IUserLocationsState> {
    constructor(props: IUserLocationsProps) {
        super(props);

        this.state = {
            userSpaces: [],
            isLoading: true,
            userName: '',
        };
    }

    componentDidMount() {
        const { getUser, routeParams } = this.props;
        const { userId } = routeParams;

        getUser(userId).then((fetchedUser: any) => {
            const name = fetchedUser?.firstName || fetchedUser?.userName || '';
            this.setState({ userName: name });
            document.title = `${name} - ${this.props.translate('pages.userLocations.pageTitle')} | Therr App`;
        }).catch(() => {
            this.props.navigation.navigate('/');
        });

        MapsService.searchSpaces(
            {
                query: 'user',
                itemsPerPage: 50,
                pageNumber: 1,
            },
            { targetUserId: userId } as any,
        ).then((response: any) => {
            this.setState({
                userSpaces: response?.data?.results || [],
                isLoading: false,
            });
        }).catch(() => {
            this.setState({ isLoading: false });
        });
    }

    handleSpaceClick = (spaceId: string) => {
        this.props.navigation.navigate(`/spaces/${spaceId}`);
    };

    render() {
        const { routeParams } = this.props;
        const { userSpaces, isLoading, userName } = this.state;

        const breadcrumbItems = [
            <Anchor href="/" key="home">{this.props.translate('pages.navigation.home')}</Anchor>,
            <Anchor href={`/users/${routeParams.userId}`} key="user">{userName || this.props.translate('pages.navigation.users')}</Anchor>,
            <Text key="locations" component="span">{this.props.translate('pages.userLocations.pageTitle')}</Text>,
        ];

        return (
            <Container id="page_user_locations" size="lg" py="xl">
                <Stack gap="lg">
                    <Breadcrumbs>{breadcrumbItems}</Breadcrumbs>

                    <Title order={1} size="h2">
                        {userName
                            ? this.props.translate('pages.userLocations.headingWithName', { name: userName })
                            : this.props.translate('pages.userLocations.pageTitle')}
                    </Title>

                    {isLoading && (
                        <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} spacing="md">
                            {[1, 2, 3, 4, 5, 6].map((i) => <Skeleton key={i} height={240} radius="md" />)}
                        </SimpleGrid>
                    )}

                    {!isLoading && userSpaces.length === 0 && (
                        <Text c="dimmed" fs="italic">
                            {this.props.translate('pages.viewUser.labels.noLocations')}
                        </Text>
                    )}

                    {!isLoading && userSpaces.length > 0 && (
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
                </Stack>
            </Container>
        );
    }
}

export default withNavigation(withTranslation(connect(mapStateToProps, mapDispatchToProps)(UserLocationsComponent)));
