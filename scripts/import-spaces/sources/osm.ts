/**
 * Fetches business data from OpenStreetMap via Overpass API.
 */
import { ICityConfig, OSM_CATEGORY_MAP, OVERPASS_API_URL } from '../config';

export interface IOsmElement {
  type: string;
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags: Record<string, string>;
}

function buildOverpassQuery(city: ICityConfig, category: string): string {
  const catConfig = OSM_CATEGORY_MAP[category];
  if (!catConfig) {
    throw new Error(`Unknown category: ${category}. Valid: ${Object.keys(OSM_CATEGORY_MAP).join(', ')}`);
  }

  const { south, west, north, east } = city.bbox;
  const bboxStr = `${south},${west},${north},${east}`;
  const filters: string[] = [];

  if (catConfig.amenity) {
    for (const val of catConfig.amenity) {
      filters.push(`node["amenity"="${val}"]["name"](${bboxStr});`);
      filters.push(`way["amenity"="${val}"]["name"](${bboxStr});`);
    }
  }
  if (catConfig.shop) {
    for (const val of catConfig.shop) {
      filters.push(`node["shop"="${val}"]["name"](${bboxStr});`);
      filters.push(`way["shop"="${val}"]["name"](${bboxStr});`);
    }
  }
  if (catConfig.tourism) {
    for (const val of catConfig.tourism) {
      filters.push(`node["tourism"="${val}"]["name"](${bboxStr});`);
      filters.push(`way["tourism"="${val}"]["name"](${bboxStr});`);
    }
  }

  return `[out:json][timeout:120];(${filters.join('')});out center;`;
}

const MAX_RETRIES = 3;
const INITIAL_BACKOFF_MS = 10000; // 10 seconds

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => { setTimeout(resolve, ms); });
}

export async function fetchOsmData(city: ICityConfig, category: string): Promise<IOsmElement[]> {
  const query = buildOverpassQuery(city, category);

  console.log(`Querying Overpass API for ${category} in ${city.name}...`);

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      const backoff = INITIAL_BACKOFF_MS * Math.pow(2, attempt - 1);
      console.log(`  Retry ${attempt}/${MAX_RETRIES} after ${backoff / 1000}s...`);
      await sleep(backoff);
    }

    let response: Response;
    try {
      response = await fetch(OVERPASS_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `data=${encodeURIComponent(query)}`,
      });
    } catch (err: any) {
      lastError = new Error(`Network error: ${err.message}`);
      console.error(`  Overpass API network error: ${err.message}`);
      continue;
    }

    if (response.status === 429) {
      const retryAfter = response.headers.get('retry-after');
      const waitSec = retryAfter ? parseInt(retryAfter, 10) : INITIAL_BACKOFF_MS / 1000;
      console.warn(`  Rate limited (429). Retry-After: ${waitSec}s`);
      lastError = new Error('Rate limited by Overpass API (429)');
      if (attempt < MAX_RETRIES) {
        await sleep(waitSec * 1000);
      }
      continue;
    }

    if (response.status === 504 || response.status === 503) {
      console.warn(`  Overpass API temporarily unavailable (${response.status})`);
      lastError = new Error(`Overpass API error: ${response.status}`);
      continue;
    }

    if (!response.ok) {
      throw new Error(`Overpass API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    const elements: IOsmElement[] = data.elements || [];

    console.log(`  Received ${elements.length} results from Overpass API`);

    return elements.filter((el) => el.tags?.name);
  }

  throw lastError || new Error('Overpass API request failed after retries');
}
