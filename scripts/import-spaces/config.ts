/**
 * Configuration for the space import CLI.
 *
 * City bounding boxes, OSM amenity mappings, and DB connection settings.
 */

export interface ICityConfig {
  name: string;
  slug: string;
  region: string;
  regionCode: string;
  country: string;
  countryCode: string;
  bbox: {
    south: number;
    west: number;
    north: number;
    east: number;
  };
}

// Bounding boxes for target cities (south, west, north, east)
export const CITIES: Record<string, ICityConfig> = {
  // ── United States ────────────────────────────────────────────────────────
  chicago: {
    name: 'Chicago',
    slug: 'chicago-il',
    region: 'Illinois',
    regionCode: 'IL',
    country: 'United States',
    countryCode: 'US',
    bbox: { south: 41.6445, west: -87.9401, north: 42.0230, east: -87.5240 },
  },
  naperville: {
    name: 'Naperville',
    slug: 'naperville-il',
    region: 'Illinois',
    regionCode: 'IL',
    country: 'United States',
    countryCode: 'US',
    bbox: { south: 41.5458, west: -88.4443, north: 41.9458, east: -88.0443 },
  },
  detroit: {
    name: 'Detroit',
    slug: 'detroit-il',
    region: 'Michigan',
    regionCode: 'MI',
    country: 'United States',
    countryCode: 'US',
    bbox: { south: 41.3290, west: -84.0452, north: 42.9290, east: -82.0452 },
  },
  'los-angeles': {
    name: 'Los Angeles',
    slug: 'los-angeles-ca',
    region: 'California',
    regionCode: 'CA',
    country: 'United States',
    countryCode: 'US',
    bbox: { south: 33.7037, west: -118.6682, north: 34.3373, east: -118.1553 },
  },
  seattle: {
    name: 'Seattle',
    slug: 'seattle-wa',
    region: 'Washington',
    regionCode: 'WA',
    country: 'United States',
    countryCode: 'US',
    bbox: { south: 47.4919, west: -122.4360, north: 47.7341, east: -122.2360 },
  },
  portland: {
    name: 'Portland',
    slug: 'portland-or',
    region: 'Oregon',
    regionCode: 'OR',
    country: 'United States',
    countryCode: 'US',
    bbox: { south: 45.4321, west: -122.8367, north: 45.6528, east: -122.4720 },
  },
  eugene: {
    name: 'Eugene',
    slug: 'eugene-or',
    region: 'Oregon',
    regionCode: 'OR',
    country: 'United States',
    countryCode: 'US',
    bbox: { south: 43.9888, west: -123.2087, north: 44.0918, east: -123.0366 },
  },
  // ── United States (Spanish-speaking) ────────────────────────────────────
  miami: {
    name: 'Miami',
    slug: 'miami-fl',
    region: 'Florida',
    regionCode: 'FL',
    country: 'United States',
    countryCode: 'US',
    bbox: { south: 25.7090, west: -80.3200, north: 25.8560, east: -80.1390 },
  },
  'san-antonio': {
    name: 'San Antonio',
    slug: 'san-antonio-tx',
    region: 'Texas',
    regionCode: 'TX',
    country: 'United States',
    countryCode: 'US',
    bbox: { south: 29.2866, west: -98.7506, north: 29.6516, east: -98.2896 },
  },
  houston: {
    name: 'Houston',
    slug: 'houston-tx',
    region: 'Texas',
    regionCode: 'TX',
    country: 'United States',
    countryCode: 'US',
    bbox: { south: 29.5233, west: -95.7880, north: 30.1105, east: -95.0144 },
  },
  'el-paso': {
    name: 'El Paso',
    slug: 'el-paso-tx',
    region: 'Texas',
    regionCode: 'TX',
    country: 'United States',
    countryCode: 'US',
    bbox: { south: 31.6200, west: -106.6350, north: 31.9660, east: -106.2060 },
  },
  dallas: {
    name: 'Dallas',
    slug: 'dallas-tx',
    region: 'Texas',
    regionCode: 'TX',
    country: 'United States',
    countryCode: 'US',
    bbox: { south: 32.6200, west: -96.9990, north: 33.0237, east: -96.4637 },
  },
  // ── Mexico ───────────────────────────────────────────────────────────────
  'mexico-city': {
    name: 'Mexico City',
    slug: 'mexico-city-cdmx',
    region: 'Ciudad de Mexico',
    regionCode: 'CDMX',
    country: 'Mexico',
    countryCode: 'MX',
    bbox: { south: 19.1887, west: -99.3500, north: 19.5928, east: -98.9603 },
  },
  guadalajara: {
    name: 'Guadalajara',
    slug: 'guadalajara-jal',
    region: 'Jalisco',
    regionCode: 'JAL',
    country: 'Mexico',
    countryCode: 'MX',
    bbox: { south: 20.5800, west: -103.4500, north: 20.7600, east: -103.2500 },
  },
  monterrey: {
    name: 'Monterrey',
    slug: 'monterrey-nl',
    region: 'Nuevo Leon',
    regionCode: 'NL',
    country: 'Mexico',
    countryCode: 'MX',
    bbox: { south: 25.5700, west: -100.4500, north: 25.8200, east: -100.2000 },
  },
  // ── Canada (French-speaking) ─────────────────────────────────────────────
  montreal: {
    name: 'Montreal',
    slug: 'montreal-qc',
    region: 'Quebec',
    regionCode: 'QC',
    country: 'Canada',
    countryCode: 'CA',
    bbox: { south: 45.4100, west: -73.9742, north: 45.7047, east: -73.4742 },
  },
  'quebec-city': {
    name: 'Quebec City',
    slug: 'quebec-city-qc',
    region: 'Quebec',
    regionCode: 'QC',
    country: 'Canada',
    countryCode: 'CA',
    bbox: { south: 46.7500, west: -71.3500, north: 46.9200, east: -71.1500 },
  },
  gatineau: {
    name: 'Gatineau',
    slug: 'gatineau-qc',
    region: 'Quebec',
    regionCode: 'QC',
    country: 'Canada',
    countryCode: 'CA',
    bbox: { south: 45.4200, west: -75.8500, north: 45.5300, east: -75.5700 },
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
