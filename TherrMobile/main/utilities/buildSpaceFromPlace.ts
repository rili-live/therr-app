import { distanceTo } from 'geolocation-utils';

/**
 * Helpers for turning a Google Places result into a Therr "space" so that a
 * user who posts a moment where no DB space exists yet can quickly create the
 * establishment they were visiting. Mirrors the field mapping used by the
 * one-off importer in scripts/import-spaces/transforms/mapToSpace.ts.
 */

export interface INearbyEstablishment {
    placeId: string;
    name: string;
    vicinity: string;
    distanceMeters: number;
    latitude: number;
    longitude: number;
    types: string[];
}

// Default buffer radius (meters) for a user-created point-of-interest space.
// Matches SPACE_RADIUS_METERS used by the spaces importer.
const DEFAULT_SPACE_RADIUS_METERS = 50;

// Google place types that describe a geographic/administrative area rather than
// an actual venue. A result whose types include any of these is not a real
// establishment the user could have "visited".
const NON_ESTABLISHMENT_TYPES = new Set<string>([
    'route',
    'political',
    'locality',
    'sublocality',
    'sublocality_level_1',
    'sublocality_level_2',
    'neighborhood',
    'postal_code',
    'postal_code_prefix',
    'country',
    'administrative_area_level_1',
    'administrative_area_level_2',
    'administrative_area_level_3',
    'plus_code',
    'intersection',
]);

// Maps a Google place type to the app's existing space category keys. The first
// matching type (in Google's priority order) wins; falls back to uncategorized.
const GOOGLE_TYPE_TO_CATEGORY: { [key: string]: string } = {
    restaurant: 'categories.restaurant/food',
    food: 'categories.restaurant/food',
    cafe: 'categories.restaurant/food',
    bakery: 'categories.restaurant/food',
    meal_takeaway: 'categories.restaurant/food',
    meal_delivery: 'categories.restaurant/food',
    bar: 'categories.bar/drinks',
    night_club: 'categories.bar/drinks',
    liquor_store: 'categories.bar/drinks',
    gym: 'categories.fitness/sports',
    stadium: 'categories.fitness/sports',
    lodging: 'categories.hotels/lodging',
    store: 'categories.storefront/shop',
    supermarket: 'categories.storefront/shop',
    grocery_or_supermarket: 'categories.storefront/shop',
    convenience_store: 'categories.storefront/shop',
    clothing_store: 'categories.storefront/shop',
    shoe_store: 'categories.storefront/shop',
    electronics_store: 'categories.storefront/shop',
    book_store: 'categories.storefront/shop',
    shopping_mall: 'categories.storefront/shop',
    department_store: 'categories.storefront/shop',
    furniture_store: 'categories.storefront/shop',
    hardware_store: 'categories.storefront/shop',
    beauty_salon: 'categories.storefront/shop',
};

export const googleTypesToCategory = (types: string[] = []): string => {
    for (let i = 0; i < types.length; i += 1) {
        const match = GOOGLE_TYPE_TO_CATEGORY[types[i]];
        if (match) {
            return match;
        }
    }

    return 'categories.uncategorized';
};

export const isRealEstablishment = (types: string[] = []): boolean => {
    if (!types.length) {
        return false;
    }

    const isEstablishment = types.includes('establishment') || types.includes('point_of_interest');
    const isGenericArea = types.some((t) => NON_ESTABLISHMENT_TYPES.has(t));

    return isEstablishment && !isGenericArea;
};

const isValidCoord = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);

/**
 * Filters raw Google Places "nearby search" results down to the closest real
 * establishments within maxDistanceMeters, sorted nearest-first.
 */
export const findNearbyEstablishments = (
    results: any[] = [],
    center: { latitude: number; longitude: number },
    maxDistanceMeters: number,
    limit = 3,
): INearbyEstablishment[] => {
    if (!results?.length || !isValidCoord(center?.latitude) || !isValidCoord(center?.longitude)) {
        return [];
    }

    return results
        .filter((place) => place?.business_status !== 'CLOSED_PERMANENTLY')
        .filter((place) => isRealEstablishment(place?.types))
        .map((place): INearbyEstablishment | null => {
            const lat = place?.geometry?.location?.lat;
            const lng = place?.geometry?.location?.lng;
            if (!isValidCoord(lat) || !isValidCoord(lng) || !place?.place_id || !place?.name) {
                return null;
            }

            const distanceMeters = distanceTo(
                { lon: center.longitude, lat: center.latitude },
                { lon: lng, lat },
            );

            return {
                placeId: place.place_id,
                name: place.name,
                vicinity: place.vicinity || place.formatted_address || '',
                distanceMeters,
                latitude: lat,
                longitude: lng,
                types: place.types || [],
            };
        })
        .filter((e): e is INearbyEstablishment => !!e && e.distanceMeters <= maxDistanceMeters)
        .sort((a, b) => a.distanceMeters - b.distanceMeters)
        .slice(0, limit);
};

/**
 * Maps a selected establishment (+ optional Google place details) to a
 * createSpace payload (ICreateSpaceBody-compatible). The space is created as a
 * public point-of-interest so it is immediately discoverable.
 */
export const buildSpaceFromPlace = (establishment: INearbyEstablishment, details: any, user: any): any => {
    const name = (details?.name || establishment.name || '').substring(0, 100);
    const addressReadable = details?.formatted_address || establishment.vicinity || '';

    return {
        fromUserId: user?.details?.id,
        locale: user?.settings?.locale || 'en-us',
        isPublic: true,
        isPointOfInterest: true,
        message: name,
        notificationMsg: name,
        hashTags: '',
        latitude: `${establishment.latitude}`,
        longitude: `${establishment.longitude}`,
        radius: `${DEFAULT_SPACE_RADIUS_METERS}`,
        category: googleTypesToCategory(establishment.types),
        addressReadable,
        phoneNumber: details?.international_phone_number || details?.formatted_phone_number || '',
        websiteUrl: details?.website || '',
    };
};
