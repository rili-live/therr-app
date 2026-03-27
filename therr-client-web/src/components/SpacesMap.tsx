import * as React from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix Leaflet default marker icon paths (broken by webpack bundling)
const LEAFLET_CDN = 'https://unpkg.com/leaflet@1.9.4/dist/images';
// eslint-disable-next-line no-underscore-dangle
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: `${LEAFLET_CDN}/marker-icon-2x.png`,
    iconUrl: `${LEAFLET_CDN}/marker-icon.png`,
    shadowUrl: `${LEAFLET_CDN}/marker-shadow.png`,
});

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
}

const SpacesMap: React.FC<ISpacesMapProps> = ({ spaces, centerLat, centerLng }) => {
    const mapRef = React.useRef<HTMLDivElement>(null);
    const leafletMapRef = React.useRef<L.Map | null>(null);

    React.useEffect(() => {
        if (!mapRef.current || leafletMapRef.current) return;

        const map = L.map(mapRef.current).setView([centerLat, centerLng], 5);

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
            maxZoom: 19,
        }).addTo(map);

        leafletMapRef.current = map;

        return () => {
            map.remove();
            leafletMapRef.current = null;
        };
    }, []);

    // Update markers when spaces change
    React.useEffect(() => {
        const map = leafletMapRef.current;
        if (!map) return;

        // Clear existing markers
        map.eachLayer((layer) => {
            if (layer instanceof L.Marker) {
                map.removeLayer(layer);
            }
        });

        const bounds: L.LatLngExpression[] = [];

        spaces.forEach((space) => {
            if (space.latitude && space.longitude) {
                const marker = L.marker([space.latitude, space.longitude]).addTo(map);
                const name = space.notificationMsg || 'Unknown';
                const address = space.addressReadable ? `<br/><small>${space.addressReadable}</small>` : '';
                marker.bindPopup(
                    `<a href="/spaces/${space.id}"><strong>${name}</strong></a>${address}`,
                );
                bounds.push([space.latitude, space.longitude]);
            }
        });

        if (bounds.length > 0) {
            map.fitBounds(L.latLngBounds(bounds), { padding: [40, 40], maxZoom: 13 });
        }
    }, [spaces]);

    return <div ref={mapRef} className="spaces-map" />;
};

export default SpacesMap;
