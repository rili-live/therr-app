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

const loadLeafletCss = () => {
    if (document.getElementById(LEAFLET_CSS_ID)) return;
    const link = document.createElement('link');
    link.id = LEAFLET_CSS_ID;
    link.rel = 'stylesheet';
    link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    document.head.appendChild(link);
};

const configureIcons = (leaflet: any) => {
    // eslint-disable-next-line no-underscore-dangle, no-param-reassign
    delete (leaflet.Icon.Default.prototype as any)._getIconUrl;
    const CDN = 'https://unpkg.com/leaflet@1.9.4/dist/images';
    leaflet.Icon.Default.mergeOptions({
        iconRetinaUrl: `${CDN}/marker-icon-2x.png`,
        iconUrl: `${CDN}/marker-icon.png`,
        shadowUrl: `${CDN}/marker-shadow.png`,
    });
};

const addMarkers = (L: any, map: any, spaces: ISpace[], localePrefix: string) => {
    // Clear existing markers
    map.eachLayer((layer: any) => {
        if (layer instanceof L.Marker) {
            map.removeLayer(layer);
        }
    });

    const bounds: any[] = [];
    const prefix = localePrefix || '';

    spaces.forEach((space) => {
        if (space.latitude && space.longitude) {
            const marker = L.marker([space.latitude, space.longitude]).addTo(map);
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
    const spacesRef = React.useRef(spaces);
    spacesRef.current = spaces;

    const [revision, setRevision] = React.useState(0);

    // Initialize Leaflet map and add initial markers
    React.useEffect(() => {
        if (!mapRef.current || leafletMapRef.current) return undefined;

        let cancelled = false;

        loadLeafletCss();

        import('leaflet').then((leafletModule) => {
            if (cancelled || !mapRef.current) return;

            const L = leafletModule.default || leafletModule;
            leafletLibRef.current = L;

            configureIcons(L);

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

            // Add markers immediately with current spaces data
            const currentSpaces = spacesRef.current;
            const bounds = addMarkers(L, map, currentSpaces, localePrefix);

            if (!zoom && bounds.length > 1) {
                map.fitBounds(L.latLngBounds(bounds), { padding: [40, 40], maxZoom: 13 });
            } else if (!zoom && bounds.length === 1) {
                map.setView(bounds[0], 15);
            }

            // Signal that map is ready for subsequent updates
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

        const bounds = addMarkers(L, map, spaces, localePrefix);

        if (!zoom && bounds.length > 1) {
            map.fitBounds(L.latLngBounds(bounds), { padding: [40, 40], maxZoom: 13 });
        } else if (!zoom && bounds.length === 1) {
            map.setView(bounds[0], 15);
        }
    }, [spaces, localePrefix, revision]);

    const style = height ? { height: `${height}px` } : undefined;

    return (
        <div
            ref={mapRef}
            className="spaces-map"
            style={style}
            role="application"
            aria-label="Map of business locations"
        />
    );
};

export default SpacesMap;
