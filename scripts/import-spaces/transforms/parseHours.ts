/**
 * Parses OSM opening_hours format into Therr's JSON schema.
 *
 * OSM format examples:
 *   "Mo-Fr 08:00-17:00"
 *   "Mo-Fr 08:00-17:00; Sa 09:00-14:00"
 *   "24/7"
 *
 * Therr format:
 *   { schema: ["Mo-Fr 08:00-17:00", "Sa 09:00-14:00"], timezone: "America/Chicago", isConfirmed: false }
 */

// City name to IANA timezone
export const CITY_TIMEZONE_MAP: Record<string, string> = {
  Chicago: 'America/Chicago',
  'Los Angeles': 'America/Los_Angeles',
  Seattle: 'America/Los_Angeles',
  Portland: 'America/Los_Angeles',
  Eugene: 'America/Los_Angeles',
  Miami: 'America/New_York',
  'San Antonio': 'America/Chicago',
  Houston: 'America/Chicago',
  'El Paso': 'America/Denver',
  Dallas: 'America/Chicago',
  'Mexico City': 'America/Mexico_City',
  Guadalajara: 'America/Mexico_City',
  Monterrey: 'America/Monterrey',
  Montreal: 'America/Montreal',
  'Quebec City': 'America/Montreal',
  Gatineau: 'America/Montreal',
};

export interface IOpeningHours {
  schema: string[];
  timezone: string;
  isConfirmed: boolean;
}

export function parseOsmHours(osmHours?: string, cityName?: string): IOpeningHours | null {
  if (!osmHours) return null;

  const timezone = (cityName && CITY_TIMEZONE_MAP[cityName]) || 'America/Chicago';

  // Handle 24/7
  if (osmHours.trim() === '24/7') {
    return {
      schema: ['Mo-Su 00:00-24:00'],
      timezone,
      isConfirmed: false,
    };
  }

  // Split by semicolons into individual rules
  const rules = osmHours.split(';').map((r) => r.trim()).filter(Boolean);

  if (rules.length === 0) return null;

  return {
    schema: rules,
    timezone,
    isConfirmed: false,
  };
}
