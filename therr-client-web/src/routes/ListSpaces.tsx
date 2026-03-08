/* eslint-disable max-len, react/jsx-no-target-blank */
import * as React from 'react';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import { Link, NavigateFunction } from 'react-router-dom';
import { MapActions } from 'therr-react/redux/actions';
import { IContentState, IMapState, IUserState } from 'therr-react/types';
import {
    Stack, Group, Title, Text, Badge, Anchor,
    Paper, Skeleton, Button, Image, SimpleGrid,
} from '@mantine/core';
import { MantineSearchBox } from 'therr-react/components/mantine';
import { ILocationState } from '../types/redux/location';
import translator from '../services/translator';
import withNavigation from '../wrappers/withNavigation';

export const DEFAULT_ITEMS_PER_PAGE = 50;
export const DEFAULT_LATITUDE = 37.1261664; // Middle of U.S. - TODO: Use browser location
export const DEFAULT_LONGITUDE = -106.2447206; // Middle of U.S. - TODO: Use browser location

const formatCategoryLabel = (category: string): string => {
    if (!category) return '';
    const label = category.replace('categories.', '').replace('/', ' & ');
    return label.charAt(0).toUpperCase() + label.slice(1);
};

interface IListSpacesRouterProps {
    navigation: {
        navigate: NavigateFunction;
    };
    routeParams: {
        pageNumber: string;
    }
}

interface IListSpacesDispatchProps {
    login: Function;
    listSpaces: Function;
    updateUserCoordinates: Function;
}

interface IStoreProps extends IListSpacesDispatchProps {
    content: IContentState;
    location: ILocationState;
    map: IMapState;
    user: IUserState;
}

// Regular component props
interface IListSpacesProps extends IListSpacesRouterProps, IStoreProps {
}

interface IListSpacesState {
    itemsPerPage: number;
    searchQuery: string;
    isSearching: boolean;
}

const mapStateToProps = (state: any) => ({
    content: state.content,
    location: state.location,
    map: state.map,
    user: state.user,
});

const mapDispatchToProps = (dispatch: any) => bindActionCreators({
    listSpaces: MapActions.listSpaces,
    updateUserCoordinates: MapActions.updateUserCoordinates,
}, dispatch);

/**
 * ListSpaces
 */
export class ListSpacesComponent extends React.Component<IListSpacesProps, IListSpacesState> {
    private translate: Function;

    constructor(props: IListSpacesProps) {
        super(props);

        this.state = {
            itemsPerPage: DEFAULT_ITEMS_PER_PAGE,
            searchQuery: '',
            isSearching: false,
        };

        this.translate = (key: string, params: any) => translator('en-us', key, params);
    }

    componentDidMount() { // eslint-disable-line class-methods-use-this
        const { map, routeParams } = this.props;
        const { pageNumber: pn } = routeParams;
        const pageNumberStr = pn || '1';

        document.title = `Therr | ${this.translate('pages.spaces.pageTitle')}`;

        const isValidPage = !Number.isNaN(pageNumberStr) && !Number.isNaN(parseInt(pageNumberStr, 10));
        if (!isValidPage) {
            setTimeout(() => this.props.navigation.navigate('/locations'));
        } else {
            const pageNumber = parseInt(pageNumberStr, 10);

            this.getLocation();

            if (!Object.values(map?.spaces || {}).length) {
                this.searchPaginatedSpaces(pageNumber);
            }
        }
    }

    componentDidUpdate(prevProps: Readonly<IListSpacesProps>): void {
        if (prevProps.routeParams.pageNumber !== this.props.routeParams.pageNumber) {
            const { location } = this.props;
            const latitude = location?.user?.latitude || DEFAULT_LATITUDE;
            const longitude = location?.user?.longitude || DEFAULT_LONGITUDE;
            this.searchPaginatedSpaces(parseInt(this.props.routeParams.pageNumber, 10), DEFAULT_ITEMS_PER_PAGE, latitude, longitude);
        }
    }

    searchPaginatedSpaces = (
        pageNumber: number,
        itemsPerPage: number = DEFAULT_ITEMS_PER_PAGE,
        lat = DEFAULT_LATITUDE,
        lon = DEFAULT_LONGITUDE,
    ) => {
        const { listSpaces } = this.props;
        const { searchQuery } = this.state;
        this.setState({
            itemsPerPage,
        });

        const queryParams: any = {
            itemsPerPage,
            pageNumber,
            latitude: lat,
            longitude: lon,
        };

        if (searchQuery.trim()) {
            queryParams.filterBy = 'notificationMsg';
            queryParams.filterOperator = 'ilike';
            queryParams.query = searchQuery.trim();
        } else {
            queryParams.filterBy = 'distance';
        }

        listSpaces(queryParams, {
            distanceOverride: 40075 * (1000 / 2), // estimated half distance around world in meters
        }).catch((err) => {
            console.log(err);
        });
    };

    handleLocation = ({
        coords: {
            latitude,
            longitude,
        },
    }) => {
        const { itemsPerPage } = this.state;
        const { routeParams } = this.props;
        const { pageNumber: pageNumberStr } = routeParams;
        this.props.updateUserCoordinates({
            latitude,
            longitude,
        });
        this.searchPaginatedSpaces(parseInt(pageNumberStr, 10), itemsPerPage, latitude, longitude);
    };

    // eslint-disable-next-line class-methods-use-this
    handleLocationError = (err) => {
        console.log(err);
    };

    getLocation = () => {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(this.handleLocation, this.handleLocationError);
        }
    };

    handleSearchChange = (_name: string, value: string) => {
        this.setState({ searchQuery: value });
    };

    handleSearch = () => {
        const { location } = this.props;
        const latitude = location?.user?.latitude || DEFAULT_LATITUDE;
        const longitude = location?.user?.longitude || DEFAULT_LONGITUDE;
        this.setState({ isSearching: true });
        this.searchPaginatedSpaces(1, DEFAULT_ITEMS_PER_PAGE, latitude, longitude);
        setTimeout(() => this.setState({ isSearching: false }), 300);
    };

    handleClearSearch = () => {
        const { location } = this.props;
        const latitude = location?.user?.latitude || DEFAULT_LATITUDE;
        const longitude = location?.user?.longitude || DEFAULT_LONGITUDE;
        this.setState({ searchQuery: '', isSearching: false }, () => {
            this.searchPaginatedSpaces(1, DEFAULT_ITEMS_PER_PAGE, latitude, longitude);
        });
    };

    login = (credentials: any) => this.props.login(credentials);

    renderVisibilityBadge(space: any): JSX.Element | null {
        const { user } = this.props;
        const isAuthenticated = user?.isAuthenticated;

        // For unauthenticated users, all listed spaces are public
        if (!isAuthenticated) {
            return <Badge variant="light" color="green" size="sm">{this.translate('pages.spaces.public')}</Badge>;
        }

        const isOwner = space.fromUserId && space.fromUserId === user?.details?.id;

        if (isOwner) {
            return (
                <Group gap={4}>
                    <Badge variant="light" color="blue" size="sm">{this.translate('pages.spaces.yours')}</Badge>
                    {!space.isPublic && <Badge variant="light" color="orange" size="sm">{this.translate('pages.spaces.private')}</Badge>}
                </Group>
            );
        }

        if (space.isPublic === false) {
            return <Badge variant="light" color="orange" size="sm">{this.translate('pages.spaces.private')}</Badge>;
        }

        return <Badge variant="light" color="green" size="sm">{this.translate('pages.spaces.public')}</Badge>;
    }

    renderSpaceCard(space: any): JSX.Element {
        const categoryLabel = formatCategoryLabel(space.category);

        return (
            <Paper key={space.id} withBorder p="md" radius="md">
                <Group justify="space-between" wrap="nowrap" align="flex-start">
                    <Stack gap={4} style={{ flex: 1 }}>
                        <Group gap="sm" wrap="wrap">
                            <Anchor component={Link} to={`/spaces/${space.id}`} fw={600} size="lg">
                                {space.notificationMsg}
                            </Anchor>
                            {this.renderVisibilityBadge(space)}
                        </Group>
                        {space.addressReadable && (
                            <Text size="sm" c="dimmed">{space.addressReadable}</Text>
                        )}
                        <Group gap="xs" wrap="wrap">
                            {categoryLabel && (
                                <Badge variant="outline" size="xs">{categoryLabel}</Badge>
                            )}
                            {space.websiteUrl && (
                                <Anchor href={space.websiteUrl} target="_blank" size="xs">website</Anchor>
                            )}
                        </Group>
                    </Stack>
                </Group>
            </Paper>
        );
    }

    renderSkeleton(): JSX.Element { // eslint-disable-line class-methods-use-this
        return (
            <Stack gap="sm">
                {[1, 2, 3, 4, 5].map((i) => (
                    <Paper key={i} withBorder p="md" radius="md">
                        <Skeleton height={20} width="60%" mb="xs" />
                        <Skeleton height={14} width="40%" mb="xs" />
                        <Skeleton height={14} width="20%" />
                    </Paper>
                ))}
            </Stack>
        );
    }

    public render(): JSX.Element | null {
        const { routeParams, map, user } = this.props;
        const { pageNumber: pageNumberStr } = routeParams;
        const { itemsPerPage, searchQuery, isSearching } = this.state;
        const spacesArray = Object.values(map?.spaces || {});
        const pageNumber = parseInt(pageNumberStr || '1', 10);
        const isAuthenticated = user?.isAuthenticated;

        return (
            <div id="page_view_spaces">
                <SimpleGrid cols={{ base: 1, md: 2 }} spacing="xl" p="xl">
                    {/* Promotional Sidebar */}
                    <Stack gap="md" align="center">
                        <Image
                            src="/assets/images/on-the-map.svg"
                            alt="Therr users on the map"
                            maw={400}
                        />
                        <Title order={2} ta="center">
                            {this.translate('pages.home.welcome')}
                        </Title>
                        <Text ta="center">{this.translate('pages.home.info')}</Text>
                        <Text ta="center">{this.translate('pages.home.info2')}</Text>
                        <Text ta="center">{this.translate('pages.home.info3')}</Text>
                        <Group gap="md" justify="center" className="store-image-links" mt="md">
                            <Anchor href="https://apps.apple.com/us/app/therr/id1569988763?platform=iphone" target="_blank" rel="noreferrer">
                                <Image
                                    aria-label="apple store link"
                                    maw={160}
                                    src="/assets/images/apple-store-download-button.svg"
                                    alt="Download Therr on the App Store"
                                />
                            </Anchor>
                            <Anchor href="https://play.google.com/store/apps/details?id=app.therrmobile" target="_blank" rel="noreferrer">
                                <Image
                                    aria-label="play store link"
                                    maw={160}
                                    src="/assets/images/play-store-download-button.svg"
                                    alt="Download Therr on Google Play"
                                />
                            </Anchor>
                        </Group>
                        <Group gap="xs" justify="center" mt="sm">
                            <Anchor href="https://www.therr.app/privacy-policy.html" target="_blank" size="sm">
                                {this.translate('components.loginForm.buttons.privacyPolicy')}
                            </Anchor>
                            <Text size="sm" c="dimmed">|</Text>
                            <Anchor href="https://www.therr.app/terms-and-conditions.html" target="_blank" size="sm">
                                {this.translate('components.loginForm.buttons.toc')}
                            </Anchor>
                        </Group>
                    </Stack>

                    {/* Directory Column */}
                    <Stack gap="lg">
                        <div>
                            <Title order={1} mb="xs">
                                {this.translate('pages.spaces.header1')}
                            </Title>
                            {!isAuthenticated && (
                                <Text size="sm" c="dimmed">
                                    <Anchor component={Link} to="/login" size="sm">Sign in</Anchor>
                                    {' '}to see your private spaces and manage listings.
                                </Text>
                            )}
                        </div>

                        {/* Search Input */}
                        <Group gap="sm">
                            <MantineSearchBox
                                id="space-search"
                                name="spaceSearch"
                                value={searchQuery}
                                onChange={this.handleSearchChange}
                                onSearch={this.handleSearch}
                                placeholder={this.translate('pages.spaces.searchPlaceholder')}
                                style={{ flex: 1 }}
                            />
                            {searchQuery && (
                                <Button variant="subtle" size="sm" onClick={this.handleClearSearch}>
                                    Clear
                                </Button>
                            )}
                        </Group>

                        {/* Results */}
                        {isSearching && this.renderSkeleton()}
                        {!isSearching && spacesArray.length === 0 && (
                            <Paper withBorder p="xl" radius="md">
                                <Text ta="center" c="dimmed">
                                    {this.translate('pages.spaces.noResults')}
                                </Text>
                            </Paper>
                        )}
                        {!isSearching && spacesArray.length > 0 && (
                            <Stack gap="sm" className="spaces-list-scroll">
                                {spacesArray.map((space) => this.renderSpaceCard(space))}
                            </Stack>
                        )}

                        {/* Pagination */}
                        <Group justify="center" gap="md">
                            {pageNumber > 1 && (
                                <Button component={Link} to={`/locations/${pageNumber - 1}`} variant="outline" size="sm">
                                    {this.translate('pages.spaces.previousPage', { pageNumber: pageNumber - 1 })}
                                </Button>
                            )}
                            {spacesArray.length >= itemsPerPage && (
                                <Button component={Link} to={`/locations/${pageNumber + 1}`} variant="outline" size="sm">
                                    {this.translate('pages.spaces.nextPage', { pageNumber: pageNumber + 1 })}
                                </Button>
                            )}
                        </Group>
                    </Stack>
                </SimpleGrid>
            </div>
        );
    }
}

export default withNavigation(connect(mapStateToProps, mapDispatchToProps)(ListSpacesComponent));
