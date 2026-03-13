/**
 * Transforms OSM elements into Therr space insert params.
 */
import { IOsmElement } from '../sources/osm';
import { ICityConfig, OSM_TO_THERR_CATEGORY, SPACE_RADIUS_METERS, DEFAULT_LOCALE } from '../config';
import { parseOsmHours } from './parseHours';

export interface ISpaceInsertParams {
  fromUserId: string;
  locale: string;
  isPublic: boolean;
  message: string;
  notificationMsg: string;
  mediaIds: string;
  mentionsIds: string;
  hashTags: string;
  maxViews: number;
  latitude: number;
  longitude: number;
  radius: number;
  category: string;
  areaType: string;
  region: string;
  addressReadable: string;
  addressStreetAddress: string;
  addressRegion: string;
  addressLocality: string;
  postalCode: number | null;
  phoneNumber: string;
  websiteUrl: string;
  isPointOfInterest: boolean;
  openingHours: string | null;
  isMatureContent: boolean;
  isModeratorApproved: boolean;
  polygonCoords: string;
  maxProximity: number;
  doesRequireProximityToView: boolean;
  isForSale: boolean;
  isHirable: boolean;
  isPromotional: boolean;
  isExclusiveToGroups: boolean;
  valuation: number;
}

function getOsmType(tags: Record<string, string>): string {
  return tags.amenity || tags.shop || tags.tourism || '';
}

function buildAddress(tags: Record<string, string>, city: ICityConfig): string {
  const parts: string[] = [];
  const street = tags['addr:street'];
  const housenumber = tags['addr:housenumber'];
  if (housenumber && street) {
    parts.push(`${housenumber} ${street}`);
  } else if (street) {
    parts.push(street);
  }
  parts.push(tags['addr:city'] || city.name);
  parts.push(tags['addr:state'] || city.stateCode);
  if (tags['addr:postcode']) {
    parts.push(tags['addr:postcode']);
  }
  return parts.join(', ');
}

function buildMessage(name: string, tags: Record<string, string>): string {
  const parts = [name];
  if (tags.cuisine) {
    parts.push(`Cuisine: ${tags.cuisine.replace(/;/g, ', ')}`);
  }
  if (tags.description) {
    parts.push(tags.description);
  }
  return parts.join(' - ');
}

function buildHashTags(tags: Record<string, string>): string {
  const result: string[] = [];
  if (tags.cuisine) {
    tags.cuisine.split(';').forEach((c) => {
      const clean = c.trim().replace(/\s+/g, '').toLowerCase();
      if (clean) result.push(clean);
    });
  }
  const osmType = getOsmType(tags);
  if (osmType) result.push(osmType);
  return result.slice(0, 10).join(',');
}

export function mapOsmToSpace(element: IOsmElement, city: ICityConfig, userId: string): ISpaceInsertParams | null {
  const { tags } = element;
  const lat = element.lat ?? element.center?.lat;
  const lon = element.lon ?? element.center?.lon;

  if (!lat || !lon || !tags.name) return null;

  const osmType = getOsmType(tags);
  const category = OSM_TO_THERR_CATEGORY[osmType] || 'categories.uncategorized';

  const streetAddress = tags['addr:housenumber']
    ? `${tags['addr:housenumber']} ${tags['addr:street'] || ''}`
    : (tags['addr:street'] || '');

  const openingHours = parseOsmHours(tags.opening_hours);

  return {
    fromUserId: userId,
    locale: DEFAULT_LOCALE,
    isPublic: true,
    message: buildMessage(tags.name, tags),
    notificationMsg: tags.name.substring(0, 100),
    mediaIds: '',
    mentionsIds: '',
    hashTags: buildHashTags(tags),
    maxViews: 0,
    latitude: lat,
    longitude: lon,
    radius: SPACE_RADIUS_METERS,
    category,
    areaType: 'spaces',
    region: 'US',
    addressReadable: buildAddress(tags, city),
    addressStreetAddress: streetAddress.trim(),
    addressRegion: tags['addr:state'] || city.stateCode,
    addressLocality: tags['addr:city'] || city.name,
    postalCode: tags['addr:postcode'] ? parseInt(tags['addr:postcode'], 10) || null : null,
    phoneNumber: tags.phone || tags['contact:phone'] || '',
    websiteUrl: tags.website || tags['contact:website'] || '',
    isPointOfInterest: true,
    openingHours: openingHours ? JSON.stringify(openingHours) : null,
    isMatureContent: false,
    isModeratorApproved: true,
    polygonCoords: '[]',
    maxProximity: 0,
    doesRequireProximityToView: false,
    isForSale: false,
    isHirable: false,
    isPromotional: false,
    isExclusiveToGroups: false,
    valuation: 0,
  };
}
