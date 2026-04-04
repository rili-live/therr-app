/* eslint-disable max-len */
import * as React from 'react';
import { connect } from 'react-redux';
import { NavigateFunction } from 'react-router-dom';
import {
    Container, Stack, Title, Text, SimpleGrid, Skeleton, Group,
} from '@mantine/core';
import { MantineButton } from 'therr-react/components/mantine';
import { IUserState } from 'therr-react/types';
import { MapsService } from 'therr-react/services';
import BusinessSpaceCard from '../components/business-profile/BusinessSpaceCard';
import withNavigation from '../wrappers/withNavigation';
import withTranslation from '../wrappers/withTranslation';

interface IManageSpacesRouterProps {
    navigation: {
        navigate: NavigateFunction;
    };
}

interface IStoreProps {
    user: IUserState;
}

interface IManageSpacesProps extends IManageSpacesRouterProps, IStoreProps {
    translate: (key: string, params?: any) => string;
}

interface IManageSpacesState {
    mySpaces: any[];
    isLoading: boolean;
}

const mapStateToProps = (state: any) => ({
    user: state.user,
});

/**
 * ManageSpaces
 */
export class ManageSpacesComponent extends React.Component<IManageSpacesProps, IManageSpacesState> {
    constructor(props: IManageSpacesProps) {
        super(props);

        this.state = {
            mySpaces: [],
            isLoading: true,
        };
    }

    componentDidMount() {
        document.title = `Therr | ${this.props.translate('pages.manageSpaces.pageTitle')}`;
        this.fetchSpaces();
    }

    fetchSpaces = () => {
        this.setState({ isLoading: true });

        MapsService.searchSpaces({
            query: 'me',
            itemsPerPage: 50,
            pageNumber: 1,
        }).then((response: any) => {
            this.setState({
                mySpaces: response?.data?.results || [],
                isLoading: false,
            });
        }).catch(() => {
            this.setState({ mySpaces: [], isLoading: false });
        });
    };

    handleSpaceClick = (spaceId: string) => {
        this.props.navigation.navigate(`/spaces/${spaceId}`);
    };

    handleEditClick = (spaceId: string) => {
        this.props.navigation.navigate(`/spaces/${spaceId}/edit`);
    };

    handleCreateClick = () => {
        this.props.navigation.navigate('/spaces/new');
    };

    navigateBack = () => {
        this.props.navigation.navigate('/user/profile');
    };

    public render(): JSX.Element {
        const { translate } = this.props;
        const { mySpaces, isLoading } = this.state;

        return (
            <div id="page_manage_spaces">
                <Container size="lg" py="xl">
                    <Stack gap="lg">
                        <Group justify="space-between" align="center">
                            <Title order={1}>{translate('pages.manageSpaces.pageTitle')}</Title>
                            <MantineButton
                                id="create_space_button"
                                text={translate('pages.manageSpaces.buttons.createNew')}
                                onClick={this.handleCreateClick}
                            />
                        </Group>

                        {isLoading && (
                            <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} spacing="md">
                                {[1, 2, 3].map((i) => <Skeleton key={i} height={240} radius="md" />)}
                            </SimpleGrid>
                        )}

                        {!isLoading && mySpaces.length === 0 && (
                            <Stack align="center" gap="md" py="xl">
                                <Text c="dimmed" fs="italic">
                                    {translate('pages.manageSpaces.noLocations')}
                                </Text>
                                <MantineButton
                                    id="create_first_space"
                                    text={translate('pages.manageSpaces.buttons.createFirst')}
                                    onClick={this.handleCreateClick}
                                    variant="light"
                                />
                            </Stack>
                        )}

                        {!isLoading && mySpaces.length > 0 && (
                            <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} spacing="md">
                                {mySpaces.map((space: any) => (
                                    <BusinessSpaceCard
                                        key={space.id}
                                        space={space}
                                        translate={translate}
                                        onSpaceClick={this.handleSpaceClick}
                                        onEditClick={this.handleEditClick}
                                    />
                                ))}
                            </SimpleGrid>
                        )}

                        <MantineButton
                            id="back_to_profile"
                            text={translate('pages.manageSpaces.buttons.backToProfile')}
                            onClick={this.navigateBack}
                            variant="subtle"
                        />
                    </Stack>
                </Container>
            </div>
        );
    }
}

export default withNavigation(withTranslation(connect(mapStateToProps)(ManageSpacesComponent)));
