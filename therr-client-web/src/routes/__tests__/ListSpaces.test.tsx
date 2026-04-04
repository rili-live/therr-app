/**
 * @jest-environment jsdom
 */

// Mock utilities that depend on global-config
import {
    ListSpacesComponent, DEFAULT_LATITUDE, DEFAULT_LONGITUDE, DEFAULT_ITEMS_PER_PAGE,
} from '../ListSpaces';

jest.mock('../../utilities/getUserContentUri', () => ({
    __esModule: true,
    default: () => 'https://example.com/image.jpg',
}));

// Mock socket-io-middleware before any imports that depend on it
jest.mock('../../socket-io-middleware', () => ({
    socketIO: {
        on: jest.fn(),
        emit: jest.fn(),
        connect: jest.fn(),
        disconnect: jest.fn(),
    },
}));

// Mock Mantine components to avoid duplicate React issue in bundled therr-react
jest.mock('therr-react/components/mantine', () => {
    const React = require('react'); // eslint-disable-line global-require
    return {
        MantineSearchBox: (props: any) => React.createElement('input', {
            id: props.id,
            name: props.name,
            value: props.value,
            onChange: (e: any) => props.onChange(props.name, e.target.value),
            placeholder: props.placeholder,
        }),
    };
});

// Mock Leaflet/SpacesMap (not available in jsdom)
jest.mock('../../components/SpacesMap', () => () => null);

describe('ListSpaces', () => {
    const mockNavigate = jest.fn();
    const mockListSpaces = jest.fn().mockResolvedValue({});
    const mockGeocodeLocation = jest.fn().mockResolvedValue({ results: [] });
    const mockUpdateUserCoordinates = jest.fn();

    const buildInstance = (overrides: Record<string, any> = {}, urlSearch = '') => {
        // Set window.location.search before constructing
        Object.defineProperty(window, 'location', {
            value: { search: urlSearch, origin: 'https://www.example.com' },
            writable: true,
            configurable: true,
        });

        const props = {
            navigation: { navigate: mockNavigate },
            routeParams: { categorySlug: '', pageNumber: '1' },
            geocodeLocation: mockGeocodeLocation,
            listSpaces: mockListSpaces,
            updateUserCoordinates: mockUpdateUserCoordinates,
            content: {} as any,
            location: { user: {} } as any,
            map: { spaces: {} } as any,
            user: {} as any,
            locale: 'en-us',
            translate: (key: string) => key,
            ...overrides,
        };

        // Construct the class directly without rendering (avoids Mantine/Enzyme issues)
        const instance = new ListSpacesComponent(props);
        return instance;
    };

    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('constructor / URL param parsing', () => {
        it('initializes with default state when no URL params', () => {
            const instance = buildInstance();

            expect((instance as any).state.searchQuery).toBe('');
            expect((instance as any).state.searchLat).toBeNull();
            expect((instance as any).state.searchLng).toBeNull();
            expect((instance as any).state.searchRadius).toBeNull();
            expect((instance as any).state.searchLocationName).toBe('');
            expect((instance as any).state.itemsPerPage).toBe(DEFAULT_ITEMS_PER_PAGE);
        });

        it('parses q param from URL', () => {
            const instance = buildInstance({}, '?q=Michigan');
            expect((instance as any).state.searchQuery).toBe('Michigan');
        });

        it('parses lat, lng, r params from URL', () => {
            const instance = buildInstance({}, '?q=Michigan&lat=44.3148&lng=-85.6024&r=300000');

            expect((instance as any).state.searchLat).toBeCloseTo(44.3148);
            expect((instance as any).state.searchLng).toBeCloseTo(-85.6024);
            expect((instance as any).state.searchRadius).toBe(300000);
        });

        it('handles invalid lat/lng gracefully (NaN guard)', () => {
            const instance = buildInstance({}, '?q=test&lat=abc&lng=xyz');

            expect((instance as any).state.searchLat).toBeNull();
            expect((instance as any).state.searchLng).toBeNull();
        });

        it('handles partial lat without lng', () => {
            const instance = buildInstance({}, '?lat=44.3');

            expect((instance as any).state.searchLat).toBeCloseTo(44.3);
            expect((instance as any).state.searchLng).toBeNull();
        });

        it('handles URL with only r param (no lat/lng)', () => {
            const instance = buildInstance({}, '?r=300000');

            expect((instance as any).state.searchLat).toBeNull();
            expect((instance as any).state.searchLng).toBeNull();
            expect((instance as any).state.searchRadius).toBe(300000);
        });
    });

    describe('getSearchCenter', () => {
        it('returns geocoded coordinates when available', () => {
            const instance = buildInstance();
            (instance as any).state.searchLat = 44.3;
            (instance as any).state.searchLng = -85.6;

            const center = instance.getSearchCenter();
            expect(center.lat).toBe(44.3);
            expect(center.lng).toBe(-85.6);
        });

        it('falls back to browser location when no geocoded search', () => {
            const instance = buildInstance({
                location: { user: { latitude: 42.0, longitude: -83.0 } } as any,
            });

            const center = instance.getSearchCenter();
            expect(center.lat).toBe(42.0);
            expect(center.lng).toBe(-83.0);
        });

        it('falls back to defaults when no browser location or geocoded search', () => {
            const instance = buildInstance();

            const center = instance.getSearchCenter();
            expect(center.lat).toBe(DEFAULT_LATITUDE);
            expect(center.lng).toBe(DEFAULT_LONGITUDE);
        });

        it('prioritizes geocoded coords over browser location', () => {
            const instance = buildInstance({
                location: { user: { latitude: 42.0, longitude: -83.0 } } as any,
            });
            (instance as any).state.searchLat = 44.3;
            (instance as any).state.searchLng = -85.6;

            const center = instance.getSearchCenter();
            expect(center.lat).toBe(44.3);
            expect(center.lng).toBe(-85.6);
        });
    });

    describe('getDistanceOverride', () => {
        it('returns search radius when set', () => {
            const instance = buildInstance();
            (instance as any).state.searchRadius = 300000;

            expect(instance.getDistanceOverride()).toBe(300000);
        });

        it('returns default distance override when no search radius', () => {
            const instance = buildInstance();

            expect(instance.getDistanceOverride()).toBe(40075 * (1000 / 2));
        });
    });

    describe('buildSearchParams', () => {
        it('returns empty string when no search state', () => {
            const instance = buildInstance();
            expect(instance.buildSearchParams()).toBe('');
        });

        it('includes q param for text-only search', () => {
            const instance = buildInstance();
            (instance as any).state.searchQuery = 'coffee shops';

            const params = instance.buildSearchParams();
            expect(params).toContain('q=coffee');
            expect(params).not.toContain('lat=');
            expect(params).not.toContain('lng=');
        });

        it('includes q, lat, lng, r for geocoded search', () => {
            const instance = buildInstance();
            (instance as any).state.searchQuery = 'Michigan';
            (instance as any).state.searchLat = 44.3148;
            (instance as any).state.searchLng = -85.6024;
            (instance as any).state.searchRadius = 300000;

            const params = instance.buildSearchParams();
            expect(params).toContain('q=Michigan');
            expect(params).toContain('lat=44.3148');
            expect(params).toContain('lng=-85.6024');
            expect(params).toContain('r=300000');
        });

        it('truncates lat/lng to 4 decimal places', () => {
            const instance = buildInstance();
            (instance as any).state.searchQuery = 'test';
            (instance as any).state.searchLat = 44.31481234567;
            (instance as any).state.searchLng = -85.60245678901;

            const params = instance.buildSearchParams();
            expect(params).toContain('lat=44.3148');
            expect(params).toContain('lng=-85.6025');
        });

        it('rounds radius to integer', () => {
            const instance = buildInstance();
            (instance as any).state.searchQuery = 'test';
            (instance as any).state.searchLat = 44.0;
            (instance as any).state.searchLng = -85.0;
            (instance as any).state.searchRadius = 299876.543;

            const params = instance.buildSearchParams();
            expect(params).toContain('r=299877');
        });

        it('omits lat/lng when only one is null', () => {
            const instance = buildInstance();
            (instance as any).state.searchQuery = 'test';
            (instance as any).state.searchLat = 44.0;
            (instance as any).state.searchLng = null;

            const params = instance.buildSearchParams();
            expect(params).toContain('q=test');
            expect(params).not.toContain('lat=');
        });
    });

    describe('searchPaginatedSpaces', () => {
        it('uses distance filter when geocoded coordinates are set', async () => {
            const instance = buildInstance();
            (instance as any).state.searchQuery = 'Michigan';
            (instance as any).state.searchLat = 44.3;
            (instance as any).state.searchLng = -85.6;
            (instance as any).state.searchRadius = 300000;

            await instance.searchPaginatedSpaces(1);

            expect(mockListSpaces).toHaveBeenCalledWith(
                expect.objectContaining({
                    latitude: 44.3,
                    longitude: -85.6,
                    filterBy: 'distance',
                }),
                expect.objectContaining({
                    distanceOverride: 300000,
                }),
            );
        });

        it('uses text search filter when query exists but no coordinates', async () => {
            const instance = buildInstance();
            (instance as any).state.searchQuery = 'coffee shops';
            (instance as any).state.searchLat = null;

            await instance.searchPaginatedSpaces(1);

            expect(mockListSpaces).toHaveBeenCalledWith(
                expect.objectContaining({
                    filterBy: 'notificationMsg',
                    filterOperator: 'ilike',
                    query: 'coffee shops',
                }),
                expect.any(Object),
            );
        });

        it('uses distance filter with defaults when no query and no coordinates', async () => {
            const instance = buildInstance();

            await instance.searchPaginatedSpaces(1);

            expect(mockListSpaces).toHaveBeenCalledWith(
                expect.objectContaining({
                    latitude: DEFAULT_LATITUDE,
                    longitude: DEFAULT_LONGITUDE,
                    filterBy: 'distance',
                }),
                expect.any(Object),
            );
        });

        it('passes correct page number and items per page', async () => {
            const instance = buildInstance();

            await instance.searchPaginatedSpaces(3, 25);

            expect(mockListSpaces).toHaveBeenCalledWith(
                expect.objectContaining({
                    pageNumber: 3,
                    itemsPerPage: 25,
                }),
                expect.any(Object),
            );
        });
    });

    describe('handleLocation (browser geolocation)', () => {
        it('does not re-fetch when geocoded search is active', () => {
            const instance = buildInstance();
            (instance as any).state.searchLat = 44.3;
            (instance as any).state.searchLng = -85.6;

            instance.handleLocation({ coords: { latitude: 42.0, longitude: -83.0 } });

            // Should update user coords but NOT re-fetch spaces
            expect(mockUpdateUserCoordinates).toHaveBeenCalledWith({ latitude: 42.0, longitude: -83.0 });
            expect(mockListSpaces).not.toHaveBeenCalled();
        });

        it('re-fetches spaces when no geocoded search is active', () => {
            const instance = buildInstance();
            (instance as any).state.searchLat = null;
            (instance as any).state.searchLng = null;

            instance.handleLocation({ coords: { latitude: 42.0, longitude: -83.0 } });

            expect(mockUpdateUserCoordinates).toHaveBeenCalledWith({ latitude: 42.0, longitude: -83.0 });
            expect(mockListSpaces).toHaveBeenCalled();
        });
    });

    describe('executeSearch', () => {
        it('calls geocodeLocation with trimmed query', () => {
            const geocodeFn = jest.fn().mockResolvedValue({ results: [] });
            const instance = buildInstance({ geocodeLocation: geocodeFn });

            instance.executeSearch('  Michigan  ');

            expect(geocodeFn).toHaveBeenCalledWith('Michigan');
        });

        it('calls geocodeLocation on non-empty query', () => {
            const geocodeFn = jest.fn().mockResolvedValue({
                results: [{
                    latitude: 44.3148,
                    longitude: -85.6024,
                    displayName: 'Michigan, United States',
                    boundingBox: [41.696, 48.306, -90.418, -82.122],
                    type: 'state',
                }],
            });
            const instance = buildInstance({ geocodeLocation: geocodeFn });

            instance.executeSearch('Michigan');

            expect(geocodeFn).toHaveBeenCalledWith('Michigan');
        });

        it('calls geocodeLocation for gibberish query (no results)', () => {
            const geocodeFn = jest.fn().mockResolvedValue({ results: [] });
            const instance = buildInstance({ geocodeLocation: geocodeFn });

            instance.executeSearch('asdfghjkl');

            expect(geocodeFn).toHaveBeenCalledWith('asdfghjkl');
        });

        it('does not throw when geocoding rejects', async () => {
            const geocodeFn = jest.fn().mockRejectedValue(new Error('Network error'));
            const instance = buildInstance({ geocodeLocation: geocodeFn });

            // Should not throw
            instance.executeSearch('Michigan');

            await new Promise((r) => { setTimeout(r, 50); });

            expect(geocodeFn).toHaveBeenCalledWith('Michigan');
        });

        it('does not call geocode when query is empty', () => {
            const geocodeFn = jest.fn().mockResolvedValue({ results: [] });
            const instance = buildInstance({ geocodeLocation: geocodeFn });

            instance.executeSearch('  ');

            expect(geocodeFn).not.toHaveBeenCalled();
        });

        it('does not call geocode when query is cleared', () => {
            const geocodeFn = jest.fn().mockResolvedValue({ results: [] });
            const instance = buildInstance({ geocodeLocation: geocodeFn });

            instance.executeSearch('');

            expect(geocodeFn).not.toHaveBeenCalled();
        });
    });
});
