/**
 * @jest-environment jsdom
 */

// Mock IntersectionObserver which is not available in jsdom
global.IntersectionObserver = class IntersectionObserver {
    constructor(private callback: IntersectionObserverCallback) {}
    observe() {
        // Immediately report the element as visible
        this.callback([{ isIntersecting: true } as IntersectionObserverEntry], this as any);
    }
    unobserve() { return null; }
    disconnect() { return null; }
} as any;

import * as React from 'react';
import { mount } from 'enzyme';
import { act } from 'react-test-renderer';

// Mock leaflet before importing SpacesMap
// Track markers added to map so eachLayer can enumerate them for removal
const mapLayers: any[] = [];
const mockMarker = {
    addTo: jest.fn().mockImplementation(() => {
        mapLayers.push(mockMarker);
        return mockMarker;
    }),
    bindPopup: jest.fn().mockReturnThis(),
    getLatLng: jest.fn().mockReturnValue([0, 0]),
};
const mockBounds = {
    getNorthEast: jest.fn().mockReturnValue({ lat: 1, lng: 1 }),
    getSouthWest: jest.fn().mockReturnValue({ lat: 0, lng: 0 }),
};
const mockMap = {
    setView: jest.fn().mockReturnThis(),
    fitBounds: jest.fn().mockReturnThis(),
    eachLayer: jest.fn().mockImplementation((cb) => [...mapLayers].forEach(cb)),
    removeLayer: jest.fn().mockImplementation((layer) => {
        const idx = mapLayers.indexOf(layer);
        if (idx >= 0) mapLayers.splice(idx, 1);
    }),
    getZoom: jest.fn().mockReturnValue(10),
    invalidateSize: jest.fn(),
    remove: jest.fn(),
    on: jest.fn(),
    getCenter: jest.fn().mockReturnValue({ lat: 0.5, lng: 0.5 }),
    getBounds: jest.fn().mockReturnValue(mockBounds),
    distance: jest.fn().mockReturnValue(1000),
};
const mockTileLayer = {
    addTo: jest.fn(),
};
const mockLatLngBounds = jest.fn().mockReturnValue([[0, 0], [1, 1]]);
const mockIcon = {};

jest.mock('leaflet', () => ({
    __esModule: true,
    default: {
        map: jest.fn().mockReturnValue(mockMap),
        tileLayer: jest.fn().mockReturnValue(mockTileLayer),
        marker: jest.fn().mockReturnValue(mockMarker),
        latLngBounds: mockLatLngBounds,
        Icon: jest.fn().mockReturnValue(mockIcon),
    },
}));

// eslint-disable-next-line import/first
import SpacesMap from '../SpacesMap';

describe('SpacesMap', () => {
    const defaultProps = {
        spaces: [
            {
                id: 'space-1',
                notificationMsg: 'Coffee Shop',
                addressReadable: '123 Main St',
                latitude: 40.7128,
                longitude: -74.006,
            },
            {
                id: 'space-2',
                notificationMsg: 'Book Store',
                addressReadable: '456 Oak Ave',
                latitude: 40.7580,
                longitude: -73.9855,
            },
        ],
        centerLat: 40.7128,
        centerLng: -74.006,
        localePrefix: '',
    };

    beforeEach(() => {
        jest.clearAllMocks();
        mapLayers.length = 0;
        // Restore mock return values cleared by clearAllMocks
        mockMarker.addTo.mockImplementation(() => {
            mapLayers.push(mockMarker);
            return mockMarker;
        });
        mockMarker.bindPopup.mockReturnThis();
        mockMarker.getLatLng.mockReturnValue([0, 0]);
        mockMap.setView.mockReturnThis();
        mockMap.fitBounds.mockReturnThis();
        mockMap.eachLayer.mockImplementation((cb) => [...mapLayers].forEach(cb));
        mockMap.removeLayer.mockImplementation((layer) => {
            const idx = mapLayers.indexOf(layer);
            if (idx >= 0) mapLayers.splice(idx, 1);
        });
        mockMap.getZoom.mockReturnValue(10);
        mockLatLngBounds.mockReturnValue([[0, 0], [1, 1]]);

        const L = require('leaflet').default; // eslint-disable-line global-require
        L.map.mockReturnValue(mockMap);
        L.tileLayer.mockReturnValue(mockTileLayer);
        L.marker.mockReturnValue(mockMarker);
        L.Icon.mockReturnValue(mockIcon);
    });

    it('renders a map container div', () => {
        const wrapper = mount(<SpacesMap {...defaultProps} />);
        expect(wrapper.find('.spaces-map').length).toBe(1);
    });

    it('renders with correct aria-label for accessibility', () => {
        const wrapper = mount(<SpacesMap {...defaultProps} />);
        expect(wrapper.find('[aria-label="Map of business locations"]').length).toBe(1);
    });

    it('initializes leaflet map after mount', async () => {
        const L = (await import('leaflet')).default;

        await act(async () => {
            mount(<SpacesMap {...defaultProps} />);
            // Allow dynamic import promise to resolve
            await new Promise((r) => { setTimeout(r, 0); });
        });

        expect(L.map).toHaveBeenCalled();
        expect(L.tileLayer).toHaveBeenCalledWith(
            expect.stringContaining('cartocdn.com'),
            expect.any(Object),
        );
    });

    it('creates a marker for each space with coordinates', async () => {
        const L = (await import('leaflet')).default;

        await act(async () => {
            mount(<SpacesMap {...defaultProps} />);
            await new Promise((r) => { setTimeout(r, 0); });
        });

        // 2 spaces × 2 updateMarkers calls (init + revision sync effect) = 4
        expect(L.marker).toHaveBeenCalledTimes(4);
        expect(L.marker).toHaveBeenCalledWith(
            [40.7128, -74.006],
            expect.any(Object),
        );
        expect(L.marker).toHaveBeenCalledWith(
            [40.7580, -73.9855],
            expect.any(Object),
        );
    });

    it('binds popups with space name and link', async () => {
        await act(async () => {
            mount(<SpacesMap {...defaultProps} />);
            await new Promise((r) => { setTimeout(r, 0); });
        });

        // 2 spaces × 2 updateMarkers calls (init + revision sync effect) = 4
        expect(mockMarker.bindPopup).toHaveBeenCalledTimes(4);
        expect(mockMarker.bindPopup).toHaveBeenCalledWith(
            expect.stringContaining('Coffee Shop'),
        );
        expect(mockMarker.bindPopup).toHaveBeenCalledWith(
            expect.stringContaining('/spaces/space-1'),
        );
    });

    it('creates an explicit Icon instance for markers', async () => {
        const L = (await import('leaflet')).default;

        await act(async () => {
            mount(<SpacesMap {...defaultProps} />);
            await new Promise((r) => { setTimeout(r, 0); });
        });

        expect(L.Icon).toHaveBeenCalledWith(
            expect.objectContaining({
                iconUrl: expect.stringContaining('marker-icon.png'),
                shadowUrl: expect.stringContaining('marker-shadow.png'),
                iconSize: [25, 41],
                iconAnchor: [12, 41],
            }),
        );
    });

    it('skips spaces without coordinates', async () => {
        const L = (await import('leaflet')).default;
        const spacesWithMissing = [
            ...defaultProps.spaces,
            { id: 'space-3', notificationMsg: 'No Coords' },
        ];

        await act(async () => {
            mount(<SpacesMap {...defaultProps} spaces={spacesWithMissing} />);
            await new Promise((r) => { setTimeout(r, 0); });
        });

        // 2 valid spaces × 2 updateMarkers calls = 4 (space-3 has no lat/lng, skipped)
        expect(L.marker).toHaveBeenCalledTimes(4);
    });

    it('fits bounds when multiple markers exist and no zoom override', async () => {
        const L = (await import('leaflet')).default;

        await act(async () => {
            mount(<SpacesMap {...defaultProps} />);
            await new Promise((r) => { setTimeout(r, 0); });
        });

        expect(L.latLngBounds).toHaveBeenCalled();
        expect(mockMap.fitBounds).toHaveBeenCalled();
    });

    it('uses setView with zoom when only one marker', async () => {
        const singleSpace = [defaultProps.spaces[0]];

        await act(async () => {
            mount(<SpacesMap {...defaultProps} spaces={singleSpace} />);
            await new Promise((r) => { setTimeout(r, 0); });
        });

        expect(mockMap.setView).toHaveBeenCalledWith(
            [40.7128, -74.006],
            15,
        );
    });

    it('uses provided zoom instead of auto-fitting', async () => {
        await act(async () => {
            mount(<SpacesMap {...defaultProps} zoom={12} />);
            await new Promise((r) => { setTimeout(r, 0); });
        });

        expect(mockMap.fitBounds).not.toHaveBeenCalled();
    });

    it('applies custom height via style', () => {
        const wrapper = mount(<SpacesMap {...defaultProps} height={500} />);
        const div = wrapper.find('.spaces-map');
        expect(div.prop('style')).toEqual({ height: '500px' });
    });

    it('includes locale prefix in popup links', async () => {
        await act(async () => {
            mount(<SpacesMap {...defaultProps} localePrefix="/es" />);
            await new Promise((r) => { setTimeout(r, 0); });
        });

        expect(mockMarker.bindPopup).toHaveBeenCalledWith(
            expect.stringContaining('/es/spaces/space-1'),
        );
    });

    it('disables interactions when interactive=false', async () => {
        const L = (await import('leaflet')).default;

        await act(async () => {
            mount(<SpacesMap {...defaultProps} interactive={false} />);
            await new Promise((r) => { setTimeout(r, 0); });
        });

        expect(L.map).toHaveBeenCalledWith(
            expect.anything(),
            expect.objectContaining({
                scrollWheelZoom: false,
                dragging: false,
                zoomControl: false,
            }),
        );
    });
});
