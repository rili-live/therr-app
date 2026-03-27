/* eslint-disable max-len, react/jsx-no-target-blank */
import * as React from 'react';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import { Link, NavigateFunction } from 'react-router-dom';
import { MapActions } from 'therr-react/redux/actions';
import { IContentState, IMapState, IUserState } from 'therr-react/types';
import { Content } from 'therr-js-utilities/constants';
import {
    Stack, Group, Title, Text, Badge, Anchor,
    Paper, Skeleton, Button, Image, Avatar,
} from '@mantine/core';
import { MantineSearchBox } from 'therr-react/components/mantine';
import { ILocationState } from '../types/redux/location';
import withNavigation from '../wrappers/withNavigation';
import withTranslation from '../wrappers/withTranslation';
import getUserContentUri from '../utilities/getUserContentUri';

// Only lazy-load on client (Leaflet requires window/document)
const SpacesMap = typeof window !== 'undefined'
    ? React.lazy(() => import('../components/SpacesMap'))
    : (() => null) as any;

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
    locale: string;
    translate: (key: string, params?: any) => string;
}

interface IListSpacesState {
    itemsPerPage: number;
    searchQuery: string;
    isSearching: boolean;
    isMapExpanded: boolean;
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
    private debounceTimeout: ReturnType<typeof setTimeout> | null = null;

    constructor(props: IListSpacesProps) {
        super(props);

        const urlParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : new URLSearchParams();
        const initialQuery = urlParams.get('q') || '';

        this.state = {
            itemsPerPage: DEFAULT_ITEMS_PER_PAGE,
            searchQuery: initialQuery,
            isSearching: false,
            isMapExpanded: false,
        };
    }

    componentDidMount() { // eslint-disable-line class-methods-use-this
        const { map, routeParams } = this.props;
        const { searchQuery } = this.state;
        const { pageNumber: pn } = routeParams;
        const pageNumberStr = pn || '1';

        document.title = searchQuery
            ? `${searchQuery} - ${this.props.translate('pages.spaces.pageTitle')} | Therr`
            : `Therr | ${this.props.translate('pages.spaces.pageTitle')}`;

        const isValidPage = !Number.isNaN(pageNumberStr) && !Number.isNaN(parseInt(pageNumberStr, 10));
        if (!isValidPage) {
            setTimeout(() => this.props.navigation.navigate('/locations'));
        } else {
            const pageNumber = parseInt(pageNumberStr, 10);

            this.getLocation();

            if (searchQuery || !Object.values(map?.spaces || {}).length) {
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

    componentWillUnmount() {
        if (this.debounceTimeout) {
            clearTimeout(this.debounceTimeout);
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

    updateSearchUrl = (query: string) => {
        const { navigation, routeParams } = this.props;
        const pageNumber = parseInt(routeParams.pageNumber || '1', 10);
        const basePath = pageNumber > 1 ? `/locations/${pageNumber}` : '/locations';
        const search = query.trim() ? `?q=${encodeURIComponent(query.trim())}` : '';

        navigation.navigate(`${basePath}${search}`, { replace: true });
    };

    handleSearchChange = (_name: string, value: string) => {
        this.setState({ searchQuery: value });

        if (this.debounceTimeout) {
            clearTimeout(this.debounceTimeout);
        }

        this.debounceTimeout = setTimeout(() => {
            this.updateSearchUrl(value);
            const { location: loc } = this.props;
            const latitude = loc?.user?.latitude || DEFAULT_LATITUDE;
            const longitude = loc?.user?.longitude || DEFAULT_LONGITUDE;
            this.setState({ isSearching: true });
            this.searchPaginatedSpaces(1, DEFAULT_ITEMS_PER_PAGE, latitude, longitude);
            setTimeout(() => this.setState({ isSearching: false }), 300);
        }, 500);
    };

    handleSearch = () => {
        const { searchQuery } = this.state;

        if (this.debounceTimeout) {
            clearTimeout(this.debounceTimeout);
        }

        this.updateSearchUrl(searchQuery);
        const { location: loc } = this.props;
        const latitude = loc?.user?.latitude || DEFAULT_LATITUDE;
        const longitude = loc?.user?.longitude || DEFAULT_LONGITUDE;
        this.setState({ isSearching: true });
        this.searchPaginatedSpaces(1, DEFAULT_ITEMS_PER_PAGE, latitude, longitude);
        setTimeout(() => this.setState({ isSearching: false }), 300);
    };

    handleClearSearch = () => {
        if (this.debounceTimeout) {
            clearTimeout(this.debounceTimeout);
        }

        this.updateSearchUrl('');
        const { location: loc } = this.props;
        const latitude = loc?.user?.latitude || DEFAULT_LATITUDE;
        const longitude = loc?.user?.longitude || DEFAULT_LONGITUDE;
        this.setState({ searchQuery: '', isSearching: false }, () => {
            this.searchPaginatedSpaces(1, DEFAULT_ITEMS_PER_PAGE, latitude, longitude);
        });
    };

    handleToggleMap = () => {
        this.setState((prevState) => ({ isMapExpanded: !prevState.isMapExpanded }));
    };

    renderVisibilityBadge(space: any): JSX.Element | null {
        const { user } = this.props;
        const isAuthenticated = user?.isAuthenticated;

        // For unauthenticated users, all listed spaces are public
        if (!isAuthenticated) {
            return <Badge variant="light" color="green" size="sm">{this.props.translate('pages.spaces.public')}</Badge>;
        }

        const isOwner = space.fromUserId && space.fromUserId === user?.details?.id;

        if (isOwner) {
            return (
                <Group gap={4}>
                    <Badge variant="light" color="blue" size="sm">{this.props.translate('pages.spaces.yours')}</Badge>
                    {!space.isPublic && <Badge variant="light" color="orange" size="sm">{this.props.translate('pages.spaces.private')}</Badge>}
                </Group>
            );
        }

        if (space.isPublic === false) {
            return <Badge variant="light" color="orange" size="sm">{this.props.translate('pages.spaces.private')}</Badge>;
        }

        return <Badge variant="light" color="green" size="sm">{this.props.translate('pages.spaces.public')}</Badge>;
    }

    renderSpaceCard(space: any): JSX.Element {
        const categoryLabel = formatCategoryLabel(space.category);
        const mediaPath = space.medias?.[0]?.path;
        const mediaType = space.medias?.[0]?.type;
        let spaceImage: string | undefined;
        if (mediaPath && mediaType === Content.mediaTypes.USER_IMAGE_PUBLIC) {
            spaceImage = getUserContentUri(space.medias[0], 80, 80, true);
        }

        return (
            <Paper key={space.id} withBorder p="md" radius="md" className="space-card">
                <Group wrap="nowrap" align="flex-start" gap="sm">
                    {spaceImage ? (
                        <Image
                            src={spaceImage}
                            alt={space.notificationMsg}
                            w={56}
                            h={56}
                            radius="md"
                            fit="cover"
                            style={{ flexShrink: 0 }}
                        />
                    ) : (
                        <Avatar size={56} radius="md" color="teal">
                            {(space.notificationMsg || '?').charAt(0).toUpperCase()}
                        </Avatar>
                    )}
                    <Stack gap={4} style={{ flex: 1, minWidth: 0 }}>
                        <Group gap="xs" wrap="wrap">
                            <Anchor component={Link} to={`/spaces/${space.id}`} fw={600} size="md" style={{ lineHeight: 1.3, wordBreak: 'break-word' }}>
                                {space.notificationMsg}
                            </Anchor>
                            {this.renderVisibilityBadge(space)}
                        </Group>
                        {space.addressReadable && (
                            <Text size="xs" c="dimmed" lineClamp={1}>{space.addressReadable}</Text>
                        )}
                        <Group gap="xs" wrap="wrap">
                            {categoryLabel && (
                                <Badge variant="outline" size="xs">{categoryLabel}</Badge>
                            )}
                            {space.websiteUrl && (
                                <Anchor href={space.websiteUrl} target="_blank" size="xs">{this.props.translate('pages.spaces.website')}</Anchor>
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
        const {
            locale, location, routeParams, map, user,
        } = this.props;
        const { pageNumber: pageNumberStr } = routeParams;
        const {
            itemsPerPage, searchQuery, isSearching, isMapExpanded,
        } = this.state;
        const spacesArray = Object.values(map?.spaces || {}) as any[];
        const pageNumber = parseInt(pageNumberStr || '1', 10);
        const isAuthenticated = user?.isAuthenticated;
        const centerLat = location?.user?.latitude || DEFAULT_LATITUDE;
        const centerLng = location?.user?.longitude || DEFAULT_LONGITUDE;
        const localePrefixMap: Record<string, string> = { es: '/es', 'fr-ca': '/fr' };
        const localePrefix = localePrefixMap[locale] || '';

        return (
            <div id="page_view_spaces">
                <Stack gap="lg" p={{ base: 'sm', sm: 'xl' }} maw={800} mx="auto">
                    <div>
                        <Title order={1} mb="xs">
                            {this.props.translate('pages.spaces.header1')}
                        </Title>
                        {!isAuthenticated && (
                            <Text size="sm" c="dimmed">
                                <Anchor component={Link} to="/login" size="sm">{this.props.translate('components.header.buttons.login')}</Anchor>
                                {' '}{this.props.translate('pages.spaces.signInPrompt')}
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
                            placeholder={this.props.translate('pages.spaces.searchPlaceholder')}
                            aria-label={this.props.translate('pages.spaces.searchPlaceholder')}
                            style={{ flex: 1 }}
                        />
                        {searchQuery && (
                            <Button variant="subtle" size="sm" onClick={this.handleClearSearch}>
                                Clear
                            </Button>
                        )}
                        <Button variant="outline" size="sm" onClick={this.handleToggleMap}>
                            {isMapExpanded
                                ? this.props.translate('pages.spaces.collapseMap')
                                : this.props.translate('pages.spaces.expandMap')}
                        </Button>
                    </Group>

                    {/* Map View - always visible in compact mode, expandable to full size */}
                    {/* key forces Leaflet remount so interactive/height changes take effect */}
                    {spacesArray.length > 0 && (
                        <React.Suspense fallback={<Skeleton height={isMapExpanded ? 300 : 200} radius="md" />}>
                            <SpacesMap
                                key={isMapExpanded ? 'expanded' : 'compact'}
                                spaces={spacesArray}
                                centerLat={centerLat}
                                centerLng={centerLng}
                                localePrefix={localePrefix}
                                height={isMapExpanded ? 300 : 200}
                                interactive={isMapExpanded}
                            />
                        </React.Suspense>
                    )}

                    {/* Results */}
                    {isSearching && this.renderSkeleton()}
                    {!isSearching && spacesArray.length === 0 && (
                        <Paper withBorder p="xl" radius="md">
                            <Text ta="center" c="dimmed">
                                {this.props.translate('pages.spaces.noResults')}
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
                            <Button
                                component={Link}
                                to={`/locations/${pageNumber - 1}${searchQuery ? `?q=${encodeURIComponent(searchQuery)}` : ''}`}
                                variant="outline"
                                size="sm"
                            >
                                {this.props.translate('pages.spaces.previousPage', { pageNumber: pageNumber - 1 })}
                            </Button>
                        )}
                        {spacesArray.length >= itemsPerPage && (
                            <Button
                                component={Link}
                                to={`/locations/${pageNumber + 1}${searchQuery ? `?q=${encodeURIComponent(searchQuery)}` : ''}`}
                                variant="outline"
                                size="sm"
                            >
                                {this.props.translate('pages.spaces.nextPage', { pageNumber: pageNumber + 1 })}
                            </Button>
                        )}
                    </Group>

                    {/* Compact App Download CTA */}
                    <Paper withBorder p="sm" radius="md" mt="md">
                        <Group justify="center" gap="md" wrap="wrap">
                            <Text size="sm" c="dimmed">{this.props.translate('pages.home.info')}</Text>
                            <Group gap="xs" className="store-image-links">
                                <Anchor href="https://apps.apple.com/us/app/therr/id1569988763?platform=iphone" target="_blank" rel="noreferrer">
                                    <Image
                                        aria-label="apple store link"
                                        maw={120}
                                        src="/assets/images/apple-store-download-button.svg"
                                        alt="Download Therr on the App Store"
                                    />
                                </Anchor>
                                <Anchor href="https://play.google.com/store/apps/details?id=app.therrmobile" target="_blank" rel="noreferrer">
                                    <Image
                                        aria-label="play store link"
                                        maw={120}
                                        src="/assets/images/play-store-download-button.svg"
                                        alt="Download Therr on Google Play"
                                    />
                                </Anchor>
                            </Group>
                        </Group>
                    </Paper>
                </Stack>
            </div>
        );
    }
}

export default withNavigation(withTranslation(connect(mapStateToProps, mapDispatchToProps)(ListSpacesComponent)));
