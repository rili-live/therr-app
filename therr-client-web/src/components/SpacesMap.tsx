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

const SpacesMap: React.FC<ISpacesMapProps> = ({
    spaces, centerLat, centerLng, localePrefix,
}) => {
    const mapRef = React.useRef<HTMLDivElement>(null);
    const leafletMapRef = React.useRef<any>(null);
    const leafletLibRef = React.useRef<any>(null);
    const [isReady, setIsReady] = React.useState(false);

    // Initialize Leaflet map
    React.useEffect(() => {
        if (!mapRef.current || leafletMapRef.current) return undefined;

        let cancelled = false;

        loadLeafletCss();

        import('leaflet').then((leafletModule) => {
            if (cancelled || !mapRef.current) return;

            const L = leafletModule.default || leafletModule;
            leafletLibRef.current = L;

            // eslint-disable-next-line no-underscore-dangle
            delete (L.Icon.Default.prototype as any)._getIconUrl;
            const CDN = 'https://unpkg.com/leaflet@1.9.4/dist/images';
            L.Icon.Default.mergeOptions({
                iconRetinaUrl: `${CDN}/marker-icon-2x.png`,
                iconUrl: `${CDN}/marker-icon.png`,
                shadowUrl: `${CDN}/marker-shadow.png`,
            });

            const map = L.map(mapRef.current).setView([centerLat, centerLng], 5);

            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
                maxZoom: 19,
            }).addTo(map);

            leafletMapRef.current = map;
            setIsReady(true);
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
        if (!map) return;

        map.setView([centerLat, centerLng], map.getZoom());
    }, [centerLat, centerLng]);

    // Update markers when spaces change or map becomes ready
    React.useEffect(() => {
        const map = leafletMapRef.current;
        const L = leafletLibRef.current;
        if (!map || !L || !isReady) return;

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

        if (bounds.length > 0) {
            map.fitBounds(L.latLngBounds(bounds), { padding: [40, 40], maxZoom: 13 });
        }
    }, [spaces, localePrefix, isReady]);

    return (
        <div
            ref={mapRef}
            className="spaces-map"
            role="application"
            aria-label="Map of business locations"
        />
    );
};

export default SpacesMap;
