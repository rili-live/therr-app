import * as React from 'react';
import 'leaflet/dist/leaflet.css';

interface ISpace {
    id: string;
    notificationMsg?: string;
    addressReadable?: string;
    latitude?: number;
    longitude?: number;
    category?: string;
}

interface IMapMoveEvent {
    lat: number;
    lng: number;
    radius: number;
}

interface ISpacesMapProps {
    spaces: ISpace[];
    centerLat: number;
    centerLng: number;
    localePrefix: string;
    zoom?: number;
    height?: number;
    interactive?: boolean;
    onMoveEnd?: (event: IMapMoveEvent) => void;
}

const escapeHtml = (str: string): string => {
    const div = document.createElement('div');
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
};

const ICON_CDN = 'https://unpkg.com/leaflet@1.9.4/dist/images';

// Tile provider: Carto Voyager (CDN-backed, free, no API key, proper cache headers)
// Override via tileLayerUrl in global-config.js if needed
import * as globalConfig from '../../../global-config';

const envConfig = globalConfig[process.env.NODE_ENV || 'production'] || globalConfig.production;
const TILE_LAYER_URL = envConfig.tileLayerUrl || 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png';
const TILE_ATTRIBUTION = TILE_LAYER_URL.includes('cartocdn')
    ? '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
    : '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

const SpacesMap: React.FC<ISpacesMapProps> = ({
    spaces,
    centerLat,
    centerLng,
    localePrefix,
    zoom,
    height,
    interactive = true,
    onMoveEnd,
}) => {
    const mapRef = React.useRef<HTMLDivElement>(null);
    const leafletMapRef = React.useRef<any>(null);
    const leafletLibRef = React.useRef<any>(null);
    const markerIconRef = React.useRef<any>(null);
    const resizeObserverRef = React.useRef<ResizeObserver | null>(null);
    const spacesRef = React.useRef(spaces);
    spacesRef.current = spaces;
    const onMoveEndRef = React.useRef(onMoveEnd);
    onMoveEndRef.current = onMoveEnd;

    const [revision, setRevision] = React.useState(0);
    const [isVisible, setIsVisible] = React.useState(false);

    // Defer map initialization until container scrolls into view
    React.useEffect(() => {
        if (!mapRef.current) return undefined;

        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    setIsVisible(true);
                    observer.disconnect();
                }
            },
            { rootMargin: '200px' }, // Start loading 200px before visible
        );

        observer.observe(mapRef.current);

        return () => observer.disconnect();
    }, []);

    const updateMarkers = React.useCallback((L: any, map: any, spacesList: ISpace[], prefix: string) => {
        // Clear existing markers (duck-type: has getLatLng and not getTileUrl, excluding tile layers)
        const markersToRemove: any[] = [];
        map.eachLayer((layer: any) => {
            if (layer.getLatLng && !layer.getTileUrl) {
                markersToRemove.push(layer);
            }
        });
        markersToRemove.forEach((m: any) => map.removeLayer(m));

        const bounds: any[] = [];

        spacesList.forEach((space) => {
            if (space.latitude && space.longitude) {
                const markerOpts = markerIconRef.current ? { icon: markerIconRef.current } : {};
                const marker = L.marker([space.latitude, space.longitude], markerOpts).addTo(map);
                const name = escapeHtml(space.notificationMsg || 'Unknown');
                const address = space.addressReadable
                    ? `<br/><small>${escapeHtml(space.addressReadable)}</small>`
                    : '';
                marker.bindPopup(
                    `<a href="${prefix}/spaces/${space.id}"><strong>${name}</strong></a>${address}`,
                );
                bounds.push([space.latitude, space.longitude]);
            }
        });

        return bounds;
    }, []);

    // Initialize Leaflet map (only after container is visible via IntersectionObserver)
    React.useEffect(() => {
        if (!isVisible || !mapRef.current || leafletMapRef.current) return undefined;

        let cancelled = false;

        // Leaflet CSS is bundled via the import at the top of this file,
        // so it's available synchronously before the map initializes.
        import('leaflet').then((leafletModule) => {
            if (cancelled || !mapRef.current) return;

            const L = leafletModule.default || leafletModule;
            leafletLibRef.current = L;

            // Create explicit icon instance to avoid default icon path issues
            try {
                markerIconRef.current = new L.Icon({
                    iconUrl: `${ICON_CDN}/marker-icon.png`,
                    iconRetinaUrl: `${ICON_CDN}/marker-icon-2x.png`,
                    shadowUrl: `${ICON_CDN}/marker-shadow.png`,
                    iconSize: [25, 41],
                    iconAnchor: [12, 41],
                    popupAnchor: [1, -34],
                    shadowSize: [41, 41],
                });
            } catch (e) {
                // Fall back to default icon if custom creation fails
                markerIconRef.current = null;
            }

            const defaultZoom = zoom || 5;
            const map = L.map(mapRef.current, {
                scrollWheelZoom: interactive,
                dragging: interactive,
                zoomControl: interactive,
            }).setView([centerLat, centerLng], defaultZoom);

            L.tileLayer(TILE_LAYER_URL, {
                attribution: TILE_ATTRIBUTION,
                maxZoom: 19,
            }).addTo(map);

            leafletMapRef.current = map;

            // Force Leaflet to recalculate container size on next frame
            requestAnimationFrame(() => {
                if (map && !cancelled) {
                    map.invalidateSize();
                }
            });

            // Watch for container resizes (e.g. page layout shifts after navigation)
            // so Leaflet re-renders tiles that were in grey/unloaded regions
            if (typeof ResizeObserver !== 'undefined' && mapRef.current) {
                const ro = new ResizeObserver(() => {
                    map.invalidateSize();
                });
                ro.observe(mapRef.current);
                resizeObserverRef.current = ro;
            }

            // Add markers immediately with current spaces data
            const currentSpaces = spacesRef.current;
            const prefix = localePrefix || '';
            const bounds = updateMarkers(L, map, currentSpaces, prefix);

            if (!zoom && bounds.length > 1) {
                map.fitBounds(L.latLngBounds(bounds), { padding: [40, 40], maxZoom: 13 });
            } else if (!zoom && bounds.length === 1) {
                map.setView(bounds[0], 15);
            }

            // Notify parent when user drags the map
            // Using dragend (not moveend) to avoid false triggers from
            // programmatic setView/fitBounds calls during init and updates
            map.on('dragend', () => {
                if (onMoveEndRef.current) {
                    const center = map.getCenter();
                    const mapBounds = map.getBounds();
                    const ne = mapBounds.getNorthEast();
                    const sw = mapBounds.getSouthWest();
                    // Approximate radius as half the diagonal distance of the visible bounds
                    const diagDist = map.distance(ne, sw);
                    onMoveEndRef.current({
                        lat: center.lat,
                        lng: center.lng,
                        radius: Math.round(diagDist / 2),
                    });
                }
            });

            setRevision(1);
        });

        return () => {
            cancelled = true;
            if (resizeObserverRef.current) {
                resizeObserverRef.current.disconnect();
                resizeObserverRef.current = null;
            }
            if (leafletMapRef.current) {
                const m = leafletMapRef.current;
                // Stop any in-progress zoom/pan animations to prevent
                // callbacks from accessing removed DOM elements
                m.stop();
                m.off();
                m.remove();
                leafletMapRef.current = null;
            }
        };
    }, [isVisible]);

    // Update center when user location changes
    React.useEffect(() => {
        const map = leafletMapRef.current;
        if (!map || !revision) return;

        map.setView([centerLat, centerLng], map.getZoom());
    }, [centerLat, centerLng, revision]);

    // Update markers when spaces change after init
    React.useEffect(() => {
        const map = leafletMapRef.current;
        const L = leafletLibRef.current;
        if (!map || !L || !revision) return;

        const prefix = localePrefix || '';
        const bounds = updateMarkers(L, map, spaces, prefix);

        if (!zoom && bounds.length > 1) {
            map.fitBounds(L.latLngBounds(bounds), { padding: [40, 40], maxZoom: 13 });
        } else if (!zoom && bounds.length === 1) {
            map.setView(bounds[0], 15);
        }
    }, [spaces, localePrefix, revision, updateMarkers, zoom]);

    const mapHeight = height || 300;

    return (
        <div
            ref={mapRef}
            className="spaces-map"
            style={{ height: `${mapHeight}px` }}
            role="application"
            aria-label="Map of business locations"
        />
    );
};

export default SpacesMap;
