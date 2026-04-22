/* eslint-disable max-len, react/jsx-no-target-blank */
import * as React from 'react';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import { Link, NavigateFunction } from 'react-router-dom';
import { MapActions } from 'therr-react/redux/actions';
import { IContentState, IMapState, IUserState } from 'therr-react/types';
import { Categories, Cities, Content } from 'therr-js-utilities/constants';
import { buildSpaceSlug } from 'therr-js-utilities/slugify';
import {
    Stack, Group, Title, Text, Badge, Anchor,
    Paper, Skeleton, Button, Image, Avatar, Loader, Center,
} from '@mantine/core';
import { MantineSearchBox } from 'therr-react/components/mantine';
import { ILocationState } from '../types/redux/location';
import withNavigation from '../wrappers/withNavigation';
import withTranslation from '../wrappers/withTranslation';
import getUserContentUri from '../utilities/getUserContentUri';
import { estimateRadiusFromBounds } from '../utilities/geocode';

// Only lazy-load on client (Leaflet requires window/document)
const SpacesMap = typeof window !== 'undefined'
    ? React.lazy(() => import('../components/SpacesMap'))
    : (() => null) as any;

export const DEFAULT_ITEMS_PER_PAGE = 50;
export const DEFAULT_LATITUDE = 37.1261664; // Middle of U.S.
export const DEFAULT_LONGITUDE = -106.2447206; // Middle of U.S.
const DEFAULT_DISTANCE_OVERRIDE = 40075 * (1000 / 2); // estimated half distance around world in meters

// TODO: Future enhancements for location search:
// - Place autocomplete dropdown using existing Google Places Autocomplete API (getPlacesSearchAutoComplete)
// - Show result count and distance labels per space card (e.g. "2.3 mi away")
// - Category filtering alongside location search (combine location + category facets)
// - Saved/recent searches via localStorage for quick re-use
// - SEO: geo-targeted meta tags (meta name="geo.position") with dynamic description
// - SEO: URL slugs for popular locations (e.g. /locations/michigan instead of query params)
// - Faceted search: combine text + location + category + price range filters

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
        categorySlug: string;
        citySlug: string;
        pageNumber: string;
    }
}

interface IListSpacesDispatchProps {
    geocodeLocation: Function;
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
    searchLat: number | null;
    searchLng: number | null;
    searchRadius: number | null;
    searchLocationName: string;
    mapMovedLat: number | null;
    mapMovedLng: number | null;
    mapMovedRadius: number | null;
    showSearchAreaButton: boolean;
    locationError: boolean;
}

const mapStateToProps = (state: any) => ({
    content: state.content,
    location: state.location,
    map: state.map,
    user: state.user,
});

const mapDispatchToProps = (dispatch: any) => bindActionCreators({
    geocodeLocation: MapActions.geocodeLocation,
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
        const parsedLat = parseFloat(urlParams.get('lat') || '');
        const parsedLng = parseFloat(urlParams.get('lng') || '');
        const parsedRadius = parseFloat(urlParams.get('r') || '');

        this.state = {
            itemsPerPage: DEFAULT_ITEMS_PER_PAGE,
            searchQuery: initialQuery,
            isSearching: false,
            isMapExpanded: false,
            searchLat: !Number.isNaN(parsedLat) ? parsedLat : null,
            searchLng: !Number.isNaN(parsedLng) ? parsedLng : null,
            searchRadius: !Number.isNaN(parsedRadius) ? parsedRadius : null,
            searchLocationName: '',
            mapMovedLat: null,
            mapMovedLng: null,
            mapMovedRadius: null,
            showSearchAreaButton: false,
            locationError: false,
        };
    }

    componentDidMount() { // eslint-disable-line class-methods-use-this
        const { map, routeParams } = this.props;
        const { searchQuery, searchLat, searchLng } = this.state;
        const { categorySlug, citySlug, pageNumber: pn } = routeParams;

        // Guard: city route with an unrecognized slug → redirect rather than search the entire world
        if (citySlug && !this.getActiveCityEntry()) {
            setTimeout(() => this.props.navigation.navigate('/locations'));
            return;
        }

        // categorySlug doubles as page number when it is not a valid category slug
        const activeCategoryKey = this.getActiveCategoryKey();
        const isCategory = !!activeCategoryKey;
        const pageNumberStr = pn || (!isCategory && categorySlug ? categorySlug : '1');

        const categoryLabel = activeCategoryKey ? formatCategoryLabel(activeCategoryKey) : '';
        if (searchQuery) {
            document.title = `${searchQuery} - ${this.props.translate('pages.spaces.pageTitle')} | Therr`;
        } else if (categoryLabel) {
            document.title = `${categoryLabel} near You | Therr`;
        } else {
            document.title = `Therr | ${this.props.translate('pages.spaces.pageTitle')}`;
        }

        const parsedPage = parseInt(pageNumberStr, 10);
        if (!isCategory && Number.isNaN(parsedPage)) {
            // If the slug is a known city, redirect to the canonical city URL
            if (categorySlug && Cities.CitySlugMap[categorySlug]) {
                setTimeout(() => this.props.navigation.navigate(`/locations/city/${categorySlug}`));
            } else {
                setTimeout(() => this.props.navigation.navigate('/locations'));
            }
        } else {
            const pageNumber = Number.isNaN(parsedPage) ? 1 : parsedPage;

            // If URL has coordinates from a previous search, use them directly
            if (searchLat != null && searchLng != null) {
                this.searchPaginatedSpaces(pageNumber);
            } else {
                // Request browser geolocation only when no search coordinates in URL
                this.getLocation();

                if (searchQuery) {
                    // Geocode the query to get coordinates (e.g. navigated from Explore with ?q=Michigan)
                    this.setState({ isSearching: true });
                    this.executeSearch(searchQuery);
                } else if (!Object.values(map?.spaces || {}).length) {
                    this.searchPaginatedSpaces(pageNumber);
                }
            }
        }
    }

    componentDidUpdate(prevProps: Readonly<IListSpacesProps>): void {
        const { categorySlug, pageNumber } = this.props.routeParams;
        const { categorySlug: prevCategorySlug, pageNumber: prevPageNumber } = prevProps.routeParams;

        const parsedPageNumber = parseInt(pageNumber, 10);
        if (prevPageNumber !== pageNumber && !Number.isNaN(parsedPageNumber)) {
            // Category + page navigation (/locations/:categorySlug/:pageNumber)
            this.searchPaginatedSpaces(parsedPageNumber);
        } else if (prevCategorySlug !== categorySlug) {
            // Single-segment param changed — could be a category or page number change
            const isCategory = !!this.getActiveCategoryKey();
            const pageNum = isCategory ? 1 : parseInt(categorySlug || '1', 10);
            this.searchPaginatedSpaces(pageNum);
        }
    }

    componentWillUnmount() {
        if (this.debounceTimeout) {
            clearTimeout(this.debounceTimeout);
        }
    }

    getSearchCenter = (): { lat: number; lng: number } => {
        const { location } = this.props;
        const { searchLat, searchLng } = this.state;

        // Geocoded search coordinates take priority
        if (searchLat != null && searchLng != null) {
            return { lat: searchLat, lng: searchLng };
        }

        // City route: use city coordinates
        const city = this.getActiveCityEntry();
        if (city) {
            return { lat: city.lat, lng: city.lng };
        }

        // Fall back to browser location, then defaults
        return {
            lat: location?.user?.latitude || DEFAULT_LATITUDE,
            lng: location?.user?.longitude || DEFAULT_LONGITUDE,
        };
    };

    getDistanceOverride = (): number => {
        const { searchRadius } = this.state;
        if (searchRadius) return searchRadius;
        // City routes use a tighter metro radius
        if (this.getActiveCityEntry()) return 50000;
        return DEFAULT_DISTANCE_OVERRIDE;
    };

    getActiveCategoryKey = (): string | undefined => {
        const { routeParams } = this.props;
        return routeParams.categorySlug
            ? Categories.SlugToCategoryMap[routeParams.categorySlug]
            : undefined;
    };

    getActiveCityEntry = () => {
        const { routeParams } = this.props;
        return routeParams.citySlug ? Cities.CitySlugMap[routeParams.citySlug] : undefined;
    };

    searchPaginatedSpaces = (
        pageNumber: number,
        itemsPerPage: number = DEFAULT_ITEMS_PER_PAGE,
    ) => {
        const { listSpaces } = this.props;
        const { searchQuery } = this.state;
        const { lat, lng } = this.getSearchCenter();

        this.setState({ itemsPerPage });

        const queryParams: any = {
            itemsPerPage,
            pageNumber,
            latitude: lat,
            longitude: lng,
            filterBy: 'distance',
        };

        // When we have a text query but no geocoded coordinates, fall back to text search
        if (searchQuery.trim() && this.state.searchLat == null) {
            queryParams.filterBy = 'notificationMsg';
            queryParams.filterOperator = 'ilike';
            queryParams.query = searchQuery.trim();
        }

        const categoryKey = this.getActiveCategoryKey();

        return listSpaces(queryParams, {
            category: categoryKey,
            distanceOverride: this.getDistanceOverride(),
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
        const { searchLat, searchLng, itemsPerPage } = this.state;
        const { routeParams } = this.props;
        const { pageNumber: pageNumberStr } = routeParams;

        this.props.updateUserCoordinates({ latitude, longitude });

        // Only use browser location if no geocoded search is active
        if (searchLat == null && searchLng == null) {
            this.searchPaginatedSpaces(parseInt(pageNumberStr, 10), itemsPerPage);
        }
    };

    // eslint-disable-next-line class-methods-use-this
    handleLocationError = (err) => {
        console.log(err);
    };

    getLocation = () => {
        if (typeof navigator !== 'undefined' && navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(this.handleLocation, this.handleLocationError);
        }
    };

    buildSearchParams = (): string => {
        const {
            searchQuery, searchLat, searchLng, searchRadius,
        } = this.state;
        const params = new URLSearchParams();

        if (searchQuery.trim()) {
            params.set('q', searchQuery.trim());
        }
        if (searchLat != null && searchLng != null) {
            params.set('lat', searchLat.toFixed(4));
            params.set('lng', searchLng.toFixed(4));
            if (searchRadius != null) {
                params.set('r', Math.round(searchRadius).toString());
            }
        }

        const str = params.toString();
        return str ? `?${str}` : '';
    };

    getLocationsBasePath = (pageNumber?: number): string => {
        const { routeParams } = this.props;
        const { categorySlug } = routeParams;
        const page = pageNumber ?? parseInt(routeParams.pageNumber || '1', 10);

        if (categorySlug) {
            return page > 1 ? `/locations/${categorySlug}/${page}` : `/locations/${categorySlug}`;
        }
        return page > 1 ? `/locations/${page}` : '/locations';
    };

    updateSearchUrl = () => {
        const { navigation } = this.props;
        const basePath = this.getLocationsBasePath();
        const search = this.buildSearchParams();

        navigation.navigate(`${basePath}${search}`, { replace: true });
    };

    executeSearch = (query: string) => {
        const { geocodeLocation } = this.props;
        this.setState({ locationError: false });

        if (!query.trim()) {
            // Clear search: reset to browser location
            this.setState({
                searchLat: null,
                searchLng: null,
                searchRadius: null,
                searchLocationName: '',
                showSearchAreaButton: false,
            }, () => {
                this.updateSearchUrl();
                this.searchPaginatedSpaces(1)
                    .then(() => this.setState({ isSearching: false }));
            });
            return;
        }

        // Try geocoding the search query
        geocodeLocation(query.trim())
            .then((data: any) => {
                const results = data?.results || [];

                if (results.length > 0) {
                    const geo = results[0];
                    const radius = estimateRadiusFromBounds(geo.boundingBox);
                    this.setState({
                        searchLat: geo.latitude,
                        searchLng: geo.longitude,
                        searchRadius: radius,
                        searchLocationName: geo.displayName,
                        showSearchAreaButton: false,
                    }, () => {
                        document.title = `${query.trim()} - ${this.props.translate('pages.spaces.pageTitle')} | Therr`;
                        this.updateSearchUrl();
                        this.searchPaginatedSpaces(1)
                            .then(() => this.setState({ isSearching: false }));
                    });
                } else {
                    // Geocoding returned no results — fall back to text search
                    this.setState({
                        searchLat: null,
                        searchLng: null,
                        searchRadius: null,
                        searchLocationName: '',
                        showSearchAreaButton: false,
                    }, () => {
                        this.updateSearchUrl();
                        this.searchPaginatedSpaces(1)
                            .then(() => this.setState({ isSearching: false }));
                    });
                }
            })
            .catch(() => {
                // Geocoding failed — fall back to text search at current location
                this.setState({
                    searchLat: null,
                    searchLng: null,
                    searchRadius: null,
                    searchLocationName: '',
                    showSearchAreaButton: false,
                }, () => {
                    this.updateSearchUrl();
                    this.searchPaginatedSpaces(1)
                        .then(() => this.setState({ isSearching: false }));
                });
            });
    };

    handleSearchChange = (_name: string, value: string) => {
        this.setState({ searchQuery: value, isSearching: true });

        if (this.debounceTimeout) {
            clearTimeout(this.debounceTimeout);
        }

        this.debounceTimeout = setTimeout(() => {
            this.executeSearch(value);
        }, 500);
    };

    handleSearch = () => {
        const { searchQuery } = this.state;

        if (this.debounceTimeout) {
            clearTimeout(this.debounceTimeout);
        }

        this.setState({ isSearching: true });
        this.executeSearch(searchQuery);
    };

    handleClearSearch = () => {
        if (this.debounceTimeout) {
            clearTimeout(this.debounceTimeout);
        }

        this.setState({
            searchQuery: '',
            isSearching: true,
            searchLat: null,
            searchLng: null,
            searchRadius: null,
            searchLocationName: '',
            showSearchAreaButton: false,
            locationError: false,
        }, () => {
            document.title = `Therr | ${this.props.translate('pages.spaces.pageTitle')}`;
            this.updateSearchUrl();
            this.searchPaginatedSpaces(1)
                .then(() => this.setState({ isSearching: false }));
        });
    };

    handleToggleMap = () => {
        this.setState((prevState) => ({ isMapExpanded: !prevState.isMapExpanded, showSearchAreaButton: false }));
    };

    handleNearMe = () => {
        if (typeof navigator !== 'undefined' && navigator.geolocation) {
            this.setState({ isSearching: true, locationError: false });
            navigator.geolocation.getCurrentPosition(
                ({ coords: { latitude, longitude } }) => {
                    this.props.updateUserCoordinates({ latitude, longitude });
                    this.setState({
                        searchLat: latitude,
                        searchLng: longitude,
                        searchRadius: 25000,
                        searchLocationName: this.props.translate('pages.spaces.yourLocation'),
                        searchQuery: '',
                        showSearchAreaButton: false,
                        isMapExpanded: true,
                        locationError: false,
                    }, () => {
                        this.updateSearchUrl();
                        this.searchPaginatedSpaces(1)
                            .then(() => this.setState({ isSearching: false }));
                    });
                },
                (err) => {
                    console.log(err);
                    this.setState({ isSearching: false, locationError: true });
                },
            );
        } else {
            this.setState({ locationError: true });
        }
    };

    handleMapMoveEnd = ({ lat, lng, radius }: { lat: number; lng: number; radius: number }) => {
        this.setState({
            mapMovedLat: lat,
            mapMovedLng: lng,
            mapMovedRadius: radius,
            showSearchAreaButton: true,
        });
    };

    handleSearchThisArea = () => {
        const { mapMovedLat, mapMovedLng, mapMovedRadius } = this.state;

        if (mapMovedLat == null || mapMovedLng == null) return;

        this.setState({
            searchLat: mapMovedLat,
            searchLng: mapMovedLng,
            searchRadius: mapMovedRadius,
            searchLocationName: '',
            searchQuery: '',
            showSearchAreaButton: false,
            isSearching: true,
            locationError: false,
        }, () => {
            this.updateSearchUrl();
            this.searchPaginatedSpaces(1)
                .then(() => this.setState({ isSearching: false }));
        });
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
                            <Anchor component={Link} to={`/spaces/${space.id}/${buildSpaceSlug(space.notificationMsg, space.addressLocality, space.addressRegion)}`} fw={600} size="md" style={{ lineHeight: 1.3, wordBreak: 'break-word' }}>
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

    // Dynamic SSR intro paragraph for city / category / city+category landings.
    // Differentiates otherwise-identical body content on ~900 landing pages — a material thin-content
    // signal both to Google and to LLM crawlers that extract page summaries for citation.
    renderLandingIntro(): JSX.Element | null {
        const categoryKey = this.getActiveCategoryKey();
        const cityEntry = this.getActiveCityEntry();
        if (!categoryKey && !cityEntry) return null;

        const categoryLabel = categoryKey ? formatCategoryLabel(categoryKey) : '';
        const cityDisplayName = cityEntry ? `${cityEntry.name}, ${cityEntry.stateAbbr}` : '';

        let key: string;
        let params: Record<string, string> = {};
        if (cityDisplayName && categoryLabel) {
            key = 'pages.spaces.introCityCategory';
            params = { city: cityDisplayName, category: categoryLabel.toLowerCase() };
        } else if (cityDisplayName) {
            key = 'pages.spaces.introCity';
            params = { city: cityDisplayName };
        } else {
            key = 'pages.spaces.introCategory';
            params = { category: categoryLabel.toLowerCase() };
        }

        return (
            <Text size="sm" mt="xs">
                {this.props.translate(key, params)}
            </Text>
        );
    }

    public render(): JSX.Element | null {
        const {
            locale, location, routeParams, map, user,
        } = this.props;
        const { pageNumber: pageNumberStr } = routeParams;
        const {
            itemsPerPage, searchQuery, isSearching, isMapExpanded,
            searchLat, searchLng, searchLocationName, showSearchAreaButton, locationError,
        } = this.state;
        const spacesArray = Object.values(map?.spaces || {}) as any[];
        const pageNumber = parseInt(pageNumberStr || '1', 10);
        const isAuthenticated = user?.isAuthenticated;

        // Use geocoded search coordinates if available, otherwise user/default location
        const centerLat = searchLat ?? location?.user?.latitude ?? DEFAULT_LATITUDE;
        const centerLng = searchLng ?? location?.user?.longitude ?? DEFAULT_LONGITUDE;

        const localePrefixMap: Record<string, string> = { es: '/es', 'fr-ca': '/fr' };
        const localePrefix = localePrefixMap[locale] || '';

        const paginationSearch = this.buildSearchParams();

        return (
            <div id="page_view_spaces">
                <Stack gap="lg" p={{ base: 'sm', sm: 'xl' }} maw={800} mx="auto">
                    <div>
                        <Title order={1} mb="xs">
                            {this.getActiveCategoryKey()
                                ? this.props.translate('pages.spaces.categoryHeading', {
                                    category: formatCategoryLabel(this.getActiveCategoryKey() || ''),
                                })
                                : this.props.translate('pages.spaces.header1')}
                        </Title>
                        {this.renderLandingIntro()}
                        {!isAuthenticated && (
                            <Text size="sm" c="dimmed">
                                <Anchor component={Link} to="/login" size="sm">{this.props.translate('components.header.buttons.login')}</Anchor>
                                {' '}{this.props.translate('pages.spaces.signInPrompt')}
                            </Text>
                        )}
                    </div>

                    {/* Search Input */}
                    <Group gap="sm" wrap="wrap">
                        <Group gap="sm" style={{ flex: 1, minWidth: 200 }}>
                            <MantineSearchBox
                                id="space-search"
                                name="spaceSearch"
                                value={searchQuery}
                                onChange={this.handleSearchChange}
                                onSearch={this.handleSearch}
                                placeholder={this.props.translate('pages.spaces.searchPlaceholderLocation')}
                                aria-label={this.props.translate('pages.spaces.searchPlaceholderLocation')}
                                style={{ flex: 1 }}
                            />
                            {searchQuery && (
                                <Button variant="subtle" size="sm" onClick={this.handleClearSearch}>
                                    {this.props.translate('pages.spaces.clear')}
                                </Button>
                            )}
                            {!searchQuery && !isSearching && spacesArray.length === 0 && (
                                <Button variant="subtle" size="sm" onClick={this.handleClearSearch}>
                                    {this.props.translate('pages.spaces.reset')}
                                </Button>
                            )}
                        </Group>
                        <Group gap="sm">
                            <Button variant="light" size="sm" onClick={this.handleNearMe}>
                                {this.props.translate('pages.spaces.nearMe')}
                            </Button>
                            <Button variant="outline" size="sm" onClick={this.handleToggleMap}>
                                {isMapExpanded
                                    ? this.props.translate('pages.spaces.collapseMap')
                                    : this.props.translate('pages.spaces.expandMap')}
                            </Button>
                        </Group>
                    </Group>

                    {/* Location error message */}
                    {locationError && (
                        <Text size="sm" c="red">
                            {this.props.translate('pages.spaces.locationError')}
                        </Text>
                    )}

                    {/* Location context label */}
                    {searchLocationName && !isSearching && (
                        <Text size="sm" c="dimmed">
                            {this.props.translate('pages.spaces.nearLocation', { location: searchLocationName })}
                        </Text>
                    )}

                    {/* Map View - always visible in compact mode, expandable to full size */}
                    {/* key forces Leaflet remount so interactive/height changes take effect */}
                    {spacesArray.length > 0 && (
                        <div style={{ position: 'relative' }}>
                            <React.Suspense fallback={<Skeleton height={isMapExpanded ? 300 : 200} radius="md" />}>
                                <SpacesMap
                                    key={`${isMapExpanded ? 'expanded' : 'compact'}-${centerLat.toFixed(2)}-${centerLng.toFixed(2)}`}
                                    spaces={spacesArray}
                                    centerLat={centerLat}
                                    centerLng={centerLng}
                                    localePrefix={localePrefix}
                                    height={isMapExpanded ? 300 : 200}
                                    interactive={isMapExpanded}
                                    onMoveEnd={isMapExpanded ? this.handleMapMoveEnd : undefined}
                                />
                            </React.Suspense>
                            {isMapExpanded && showSearchAreaButton && (
                                <Button
                                    variant="filled"
                                    size="sm"
                                    onClick={this.handleSearchThisArea}
                                    style={{
                                        position: 'absolute',
                                        top: 14,
                                        left: '50%',
                                        transform: 'translateX(-50%)',
                                        zIndex: 1000,
                                        boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
                                    }}
                                >
                                    {this.props.translate('pages.spaces.searchThisArea')}
                                </Button>
                            )}
                        </div>
                    )}

                    {/* Results */}
                    {isSearching && (
                        <Center py="xl">
                            <Loader size="md" />
                        </Center>
                    )}
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
                                to={`${this.getLocationsBasePath(pageNumber - 1)}${paginationSearch}`}
                                variant="outline"
                                size="sm"
                            >
                                {this.props.translate('pages.spaces.previousPage', { pageNumber: pageNumber - 1 })}
                            </Button>
                        )}
                        {spacesArray.length >= itemsPerPage && (
                            <Button
                                component={Link}
                                to={`${this.getLocationsBasePath(pageNumber + 1)}${paginationSearch}`}
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
