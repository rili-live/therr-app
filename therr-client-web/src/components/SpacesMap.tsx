import * as React from 'react';

interface ISpace {
    id: string;
    notificationMsg?: string;
    addressReadable?: string;
    latitude?: number;
    longitude?: number;
    category?: string;
}

interface ISpacesMapProps {
    spaces: ISpace[];
    centerLat: number;
    centerLng: number;
    localePrefix: string;
    zoom?: number;
    height?: number;
    interactive?: boolean;
}

const escapeHtml = (str: string): string => {
    const div = document.createElement('div');
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
};

const LEAFLET_CSS_ID = 'leaflet-css';
const ICON_CDN = 'https://unpkg.com/leaflet@1.9.4/dist/images';

const loadLeafletCss = (onLoad?: () => void) => {
    if (document.getElementById(LEAFLET_CSS_ID)) {
        onLoad?.();
        return;
    }
    const link = document.createElement('link');
    link.id = LEAFLET_CSS_ID;
    link.rel = 'stylesheet';
    link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    if (onLoad) {
        link.onload = () => onLoad();
        link.onerror = () => onLoad(); // still recalculate even if CSS fails
    }
    document.head.appendChild(link);
};

const SpacesMap: React.FC<ISpacesMapProps> = ({
    spaces,
    centerLat,
    centerLng,
    localePrefix,
    zoom,
    height,
    interactive = true,
}) => {
    const mapRef = React.useRef<HTMLDivElement>(null);
    const leafletMapRef = React.useRef<any>(null);
    const leafletLibRef = React.useRef<any>(null);
    const markerIconRef = React.useRef<any>(null);
    const spacesRef = React.useRef(spaces);
    spacesRef.current = spaces;

    const [revision, setRevision] = React.useState(0);

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

    // Initialize Leaflet map
    React.useEffect(() => {
        if (!mapRef.current || leafletMapRef.current) return undefined;

        let cancelled = false;

        // Start loading Leaflet CSS; when it finishes, recalculate map size
        loadLeafletCss(() => {
            if (!cancelled && leafletMapRef.current) {
                leafletMapRef.current.invalidateSize();
            }
        });

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

            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
                maxZoom: 19,
            }).addTo(map);

            leafletMapRef.current = map;

            // Force Leaflet to recalculate container size on next frame
            // (handles case where CSS loaded before map init)
            requestAnimationFrame(() => {
                if (map && !cancelled) {
                    map.invalidateSize();
                }
            });

            // Add markers immediately with current spaces data
            const currentSpaces = spacesRef.current;
            const prefix = localePrefix || '';
            const bounds = updateMarkers(L, map, currentSpaces, prefix);

            if (!zoom && bounds.length > 1) {
                map.fitBounds(L.latLngBounds(bounds), { padding: [40, 40], maxZoom: 13 });
            } else if (!zoom && bounds.length === 1) {
                map.setView(bounds[0], 15);
            }

            setRevision(1);
        });

        return () => {
            cancelled = true;
            if (leafletMapRef.current) {
                leafletMapRef.current.remove();
                leafletMapRef.current = null;
            }
        };
    }, []);

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

    const mapHeight = height || 400;

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
