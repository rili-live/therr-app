/**
 * Website crawling for business details extraction.
 * Extracts description, opening hours, and other metadata from a business website.
 */

export interface IBusinessDetails {
  description: string | null;
  openingHours: string[] | null;
  phoneNumber: string | null;
}

/**
 * Fetch a page and return its HTML, or null on failure.
 */
export async function fetchPage(url: string): Promise<string | null> {
  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(10000),
      redirect: 'follow',
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; TherSpaceBot/1.0)',
        Accept: 'text/html',
      },
    });

    if (!response.ok) return null;

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('text/html') && !contentType.includes('application/xhtml')) return null;

    return response.text();
  } catch {
    return null;
  }
}

/**
 * Extract meta description or og:description from HTML.
 */
function extractDescription(html: string): string | null {
  // Try og:description first (usually better for businesses)
  const ogMatch = html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i)
    || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:description["']/i);
  if (ogMatch?.[1]) {
    const desc = ogMatch[1].trim();
    if (desc.length >= 20 && desc.length <= 500) return desc;
  }

  // Fall back to meta description
  const metaMatch = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i)
    || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']description["']/i);
  if (metaMatch?.[1]) {
    const desc = metaMatch[1].trim();
    if (desc.length >= 20 && desc.length <= 500) return desc;
  }

  return null;
}

/**
 * Extract phone number from tel: links in HTML.
 */
function extractPhone(html: string): string | null {
  const telMatch = html.match(/href=["']tel:([^"']+)["']/i);
  if (telMatch?.[1]) {
    const phone = telMatch[1].trim().replace(/\s+/g, '');
    if (phone.length >= 7) return phone;
  }

  return null;
}

// Common day abbreviations for opening hours detection
const DAY_PATTERN = /(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tue|wed|thu|fri|sat|sun)/i;
const TIME_PATTERN = /\d{1,2}(?::\d{2})?\s*(?:am|pm|AM|PM)/;

/**
 * Flatten JSON-LD data, handling @graph arrays and top-level arrays.
 */
function flattenJsonLd(data: any): any[] { // eslint-disable-line @typescript-eslint/no-explicit-any
  const items: any[] = []; // eslint-disable-line @typescript-eslint/no-explicit-any

  if (Array.isArray(data)) {
    for (const item of data) {
      items.push(...flattenJsonLd(item));
    }
  } else if (data && typeof data === 'object') {
    items.push(data);
    if (Array.isArray(data['@graph'])) {
      for (const item of data['@graph']) {
        items.push(...flattenJsonLd(item));
      }
    }
  }

  return items;
}

/**
 * Extract structured opening hours from JSON-LD schema.org markup.
 */
function extractJsonLdHours(html: string): string[] | null {
  const scriptRegex = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match: RegExpExecArray | null;

  // eslint-disable-next-line no-cond-assign
  while ((match = scriptRegex.exec(html)) !== null) {
    try {
      const data = JSON.parse(match[1]);
      const targets = flattenJsonLd(data);

      for (const item of targets) {
        const hours = item.openingHours || item.openingHoursSpecification;
        if (!hours) continue;

        // openingHours as a single string like "Mo-Fr 09:00-17:00"
        if (typeof hours === 'string') {
          const rules = hours.split(';').map((r: string) => r.trim()).filter(Boolean);
          if (rules.length > 0) return rules;
        }

        // openingHours as a string array like ["Mo-Fr 09:00-17:00"]
        if (Array.isArray(hours) && hours.length > 0 && typeof hours[0] === 'string') {
          return hours.filter((h: string) => h.length > 0 && h.length < 100);
        }

        // openingHoursSpecification as an array of objects
        if (Array.isArray(hours) && hours.length > 0 && typeof hours[0] === 'object') {
          const rules: string[] = [];
          for (const spec of hours) {
            const days = spec.dayOfWeek;
            const opens = spec.opens;
            const closes = spec.closes;
            if (days && opens && closes) {
              const dayList = (Array.isArray(days) ? days : [days])
                .map((d: string) => d.replace('https://schema.org/', '').replace('http://schema.org/', '').substring(0, 2))
                .join(',');
              rules.push(`${dayList} ${opens}-${closes}`);
            }
          }
          if (rules.length > 0) return rules;
        }
      }
    } catch {
      // Invalid JSON-LD, skip
    }
  }

  return null;
}

/**
 * Extract opening hours from visible text patterns.
 * Looks for lines containing both a day name and a time.
 */
function extractTextHours(html: string): string[] | null {
  // Strip script/style, then tags
  const stripped = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, '\n');

  const lines = stripped.split('\n').map((l) => l.trim()).filter(Boolean);
  const hourLines: string[] = [];

  for (const line of lines) {
    // Match lines containing both a day name and a time
    if (DAY_PATTERN.test(line) && TIME_PATTERN.test(line) && line.length < 100) {
      hourLines.push(line);
    }
  }

  if (hourLines.length >= 2 && hourLines.length <= 14) {
    return hourLines;
  }

  return null;
}

/**
 * Extract business details from pre-fetched HTML.
 * Use this when you already have the HTML to avoid a redundant fetch.
 */
export function extractDetailsFromHtml(html: string): IBusinessDetails {
  return {
    description: extractDescription(html),
    phoneNumber: extractPhone(html),
    openingHours: extractJsonLdHours(html) || extractTextHours(html),
  };
}

/**
 * Crawl a website and extract business details (description, hours, phone).
 * Returns only fields that were successfully extracted.
 *
 * If `html` is provided, skips fetching and parses the given HTML directly.
 */
export async function crawlForDetails(url: string, html?: string): Promise<IBusinessDetails> {
  const empty: IBusinessDetails = {
    description: null,
    openingHours: null,
    phoneNumber: null,
  };

  try {
    if (html) {
      return extractDetailsFromHtml(html);
    }

    let normalizedUrl = url;
    if (!normalizedUrl.startsWith('http://') && !normalizedUrl.startsWith('https://')) {
      normalizedUrl = `https://${normalizedUrl}`;
    }

    const fetched = await fetchPage(normalizedUrl);
    if (!fetched) return empty;

    return extractDetailsFromHtml(fetched);
  } catch {
    return empty;
  }
}
