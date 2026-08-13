/**
 * Parses schema.org opening hours into Therr's JSON schema.
 *
 * Sites express hours in two shapes, and both appear in the wild:
 *
 *   openingHours: "Mo-Fr 08:00-17:00"           (string or string[], OSM-like)
 *   openingHoursSpecification: [                 (structured objects)
 *     { dayOfWeek: ["Monday","Tuesday"], opens: "08:00", closes: "17:00" }
 *   ]
 *
 * Both are normalized to the same `{ schema, timezone, isConfirmed }` shape
 * that `parseOsmHours` produces, so the two import paths stay interchangeable.
 */
import { IOpeningHours, CITY_TIMEZONE_MAP } from './parseHours';

/** schema.org day names / URLs → the two-letter codes used in Therr's schema. */
const DAY_CODES: Record<string, string> = {
  monday: 'Mo',
  tuesday: 'Tu',
  wednesday: 'We',
  thursday: 'Th',
  friday: 'Fr',
  saturday: 'Sa',
  sunday: 'Su',
  publicholidays: 'PH',
};

const DAY_ORDER = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

function toDayCode(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  // Values are often full URLs: "https://schema.org/Monday"
  const leaf = value.split('/').pop() || value;
  return DAY_CODES[leaf.trim().toLowerCase()] || null;
}

/** "08:00:00" / "8:00" / "08:00" → "08:00". Returns null for unparseable input. */
function normalizeTime(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const match = value.trim().match(/^(\d{1,2}):(\d{2})/);
  if (!match) return null;
  const hours = parseInt(match[1], 10);
  if (Number.isNaN(hours) || hours > 24) return null;
  return `${String(hours).padStart(2, '0')}:${match[2]}`;
}

/**
 * Collapse consecutive days sharing the same hours into a range.
 * ["Mo","Tu","We"] → "Mo-We"; non-consecutive days stay comma-separated.
 */
function formatDays(days: string[]): string {
  const sorted = days
    .filter((d, idx) => days.indexOf(d) === idx)
    .sort((a, b) => DAY_ORDER.indexOf(a) - DAY_ORDER.indexOf(b));

  const parts: string[] = [];
  let runStart = 0;

  for (let i = 0; i <= sorted.length; i++) {
    const isRunEnd = i === sorted.length
      || DAY_ORDER.indexOf(sorted[i]) !== DAY_ORDER.indexOf(sorted[i - 1]) + 1;

    if (i > 0 && isRunEnd) {
      const runLength = i - runStart;
      if (runLength >= 3) {
        parts.push(`${sorted[runStart]}-${sorted[i - 1]}`);
      } else {
        for (let j = runStart; j < i; j++) parts.push(sorted[j]);
      }
      runStart = i;
    }
  }

  return parts.join(',');
}

function fromSpecification(specs: any[]): string[] {
  // Group by "opens-closes" so days with identical hours collapse into one rule.
  const byWindow = new Map<string, string[]>();

  for (const spec of specs) {
    if (!spec || typeof spec !== 'object') continue;

    const opens = normalizeTime(spec.opens);
    const closes = normalizeTime(spec.closes);
    if (!opens || !closes) continue;

    const rawDays = Array.isArray(spec.dayOfWeek) ? spec.dayOfWeek : [spec.dayOfWeek];
    const days = rawDays.map(toDayCode).filter((d: string | null): d is string => d !== null);
    if (days.length === 0) continue;

    const window = `${opens}-${closes}`;
    const existing = byWindow.get(window) || [];
    byWindow.set(window, existing.concat(days));
  }

  const rules: string[] = [];
  for (const [window, days] of byWindow.entries()) {
    const formatted = formatDays(days);
    if (formatted) rules.push(`${formatted} ${window}`);
  }

  return rules;
}

/**
 * Normalize a schema.org `openingHours` or `openingHoursSpecification` value.
 * Returns null when nothing parseable is present.
 */
export function parseSchemaHours(raw: unknown, cityName?: string): IOpeningHours | null {
  if (!raw) return null;

  const timezone = (cityName && CITY_TIMEZONE_MAP[cityName]) || 'America/Chicago';
  let schema: string[] = [];

  if (typeof raw === 'string') {
    schema = raw.split(';').map((r) => r.trim()).filter(Boolean);
  } else if (Array.isArray(raw)) {
    if (raw.every((item) => typeof item === 'string')) {
      schema = (raw as string[]).map((r) => r.trim()).filter(Boolean);
    } else {
      schema = fromSpecification(raw);
    }
  } else if (typeof raw === 'object') {
    schema = fromSpecification([raw]);
  }

  if (schema.length === 0) return null;

  return { schema, timezone, isConfirmed: false };
}
