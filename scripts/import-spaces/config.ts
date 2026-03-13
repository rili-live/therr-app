/**
 * Configuration for the space import CLI.
 *
 * City bounding boxes, OSM amenity mappings, and DB connection settings.
 */

export interface ICityConfig {
  name: string;
  slug: string;
  state: string;
  stateCode: string;
  bbox: {
    south: number;
    west: number;
    north: number;
    east: number;
  };
}

// Bounding boxes for target cities (south, west, north, east)
export const CITIES: Record<string, ICityConfig> = {
  chicago: {
    name: 'Chicago',
    slug: 'chicago-il',
    state: 'Illinois',
    stateCode: 'IL',
    bbox: { south: 41.6445, west: -87.9401, north: 42.0230, east: -87.5240 },
  },
  'los-angeles': {
    name: 'Los Angeles',
    slug: 'los-angeles-ca',
    state: 'California',
    stateCode: 'CA',
    bbox: { south: 33.7037, west: -118.6682, north: 34.3373, east: -118.1553 },
  },
  seattle: {
    name: 'Seattle',
    slug: 'seattle-wa',
    state: 'Washington',
    stateCode: 'WA',
    bbox: { south: 47.4919, west: -122.4360, north: 47.7341, east: -122.2360 },
  },
  portland: {
    name: 'Portland',
    slug: 'portland-or',
    state: 'Oregon',
    stateCode: 'OR',
    bbox: { south: 45.4321, west: -122.8367, north: 45.6528, east: -122.4720 },
  },
  eugene: {
    name: 'Eugene',
    slug: 'eugene-or',
    state: 'Oregon',
    stateCode: 'OR',
    bbox: { south: 43.9888, west: -123.2087, north: 44.0918, east: -123.0366 },
  },
};

// Maps CLI category names to OSM amenity/shop tags
export const OSM_CATEGORY_MAP: Record<string, { amenity?: string[]; shop?: string[]; tourism?: string[] }> = {
  restaurant: { amenity: ['restaurant'] },
  cafe: { amenity: ['cafe'] },
  bar: { amenity: ['bar', 'pub', 'nightclub'] },
  shop: { shop: ['supermarket', 'convenience', 'clothes', 'shoes', 'electronics', 'books', 'gift', 'beauty', 'hardware', 'furniture'] },
  hotel: { tourism: ['hotel', 'motel', 'hostel', 'guest_house'] },
  gym: { amenity: ['gym'] },
  all: {
    amenity: ['restaurant', 'cafe', 'bar', 'pub', 'nightclub', 'gym'],
    shop: ['supermarket', 'convenience', 'clothes', 'shoes', 'electronics', 'books', 'gift', 'beauty', 'hardware', 'furniture'],
    tourism: ['hotel', 'motel', 'hostel', 'guest_house'],
  },
};

// Maps OSM amenity/shop/tourism tags to Therr space categories
export const OSM_TO_THERR_CATEGORY: Record<string, string> = {
  restaurant: 'categories.restaurant/food',
  cafe: 'categories.restaurant/food',
  bar: 'categories.bar/drinks',
  pub: 'categories.bar/drinks',
  nightclub: 'categories.bar/drinks',
  gym: 'categories.fitness/sports',
  hotel: 'categories.hotels/lodging',
  motel: 'categories.hotels/lodging',
  hostel: 'categories.hotels/lodging',
  guest_house: 'categories.hotels/lodging',
  supermarket: 'categories.storefront/shop',
  convenience: 'categories.storefront/shop',
  clothes: 'categories.storefront/shop',
  shoes: 'categories.storefront/shop',
  electronics: 'categories.storefront/shop',
  books: 'categories.storefront/shop',
  gift: 'categories.storefront/shop',
  beauty: 'categories.storefront/shop',
  hardware: 'categories.storefront/shop',
  furniture: 'categories.storefront/shop',
};

export const OVERPASS_API_URL = 'https://overpass-api.de/api/interpreter';

export const SPACE_RADIUS_METERS = 50;

export const IMPORT_USER_ID = '568bf5d2-8595-4fd6-95da-32cc318618d3';

export const DEFAULT_LOCALE = 'en-us';

export const BATCH_SIZE = 50;
