/**
 * schema.org JSON-LD extraction.
 *
 * Most restaurant/retail sites — and every site built on Squarespace, Wix,
 * Shopify, Toast, Square, BentoBox, or WordPress with an SEO plugin — publish a
 * `LocalBusiness` / `Restaurant` node in a `<script type="application/ld+json">`
 * block. That single node carries image, telephone, email, menu URL, price
 * range, cuisine, and opening hours, all of which we were previously either
 * guessing at from raw HTML or not collecting at all.
 *
 * Parsing it first is both more accurate and cheaper than heuristics: it is the
 * business's own declaration of its metadata.
 */

/** schema.org @type values that represent a physical business. */
const BUSINESS_TYPES = new Set([
  'localbusiness',
  'restaurant',
  'cafeorcoffeeshop',
  'bakery',
  'barorpub',
  'nightclub',
  'brewery',
  'winery',
  'distillery',
  'fastfoodrestaurant',
  'store',
  'shoppingcenter',
  'clothingstore',
  'groceryorsupermarket',
  'conveniencestore',
  'bookstore',
  'electronicsstore',
  'furniturestore',
  'hardwarestore',
  'jewelrystore',
  'petstore',
  'sportinggoodsstore',
  'healthandbeautybusiness',
  'beautysalon',
  'hairsalon',
  'dayspa',
  'nailsalon',
  'gym',
  'sportsactivitylocation',
  'exercisegym',
  'healthclub',
  'yogastudio',
  'lodgingbusiness',
  'hotel',
  'motel',
  'hostel',
  'bedandbreakfast',
  'resort',
  'foodestablishment',
  'entertainmentbusiness',
  'movietheater',
  'museum',
  'touristattraction',
  'professionalservice',
  'organization',
]);

export interface IStructuredBusiness {
  image?: string[];
  telephone?: string;
  email?: string;
  menuUrl?: string;
  orderUrl?: string;
  reservationUrl?: string;
  priceRange?: string;
  servesCuisine?: string[];
  /** Raw schema.org openingHoursSpecification / openingHours, un-normalized. */
  openingHours?: any;
  name?: string;
  /** Which @type matched, for logging. */
  matchedType?: string;
}

/**
 * Pull every JSON-LD payload out of a page.
 * Bad blocks are skipped silently — a single malformed script is common and
 * must not discard the valid ones alongside it.
 */
function extractJsonLdBlocks(html: string): any[] {
  const blocks: any[] = [];
  const scriptRegex = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;

  let match: RegExpExecArray | null;
  // eslint-disable-next-line no-cond-assign
  while ((match = scriptRegex.exec(html)) !== null) {
    const raw = match[1].trim()
      // Some CMSs emit CDATA wrappers or HTML comments around the payload.
      .replace(/^<!\[CDATA\[/, '')
      .replace(/\]\]>$/, '')
      .replace(/^<!--/, '')
      .replace(/-->$/, '');
    if (!raw) continue;
    try {
      blocks.push(JSON.parse(raw));
    } catch {
      // Malformed block — skip it and keep going.
    }
  }

  return blocks;
}

/**
 * Walk a JSON-LD payload and yield every object node, following `@graph`,
 * arrays, and nested values. Sites routinely bury the business node several
 * levels down inside a WebPage or @graph wrapper.
 */
function* walkNodes(value: any, depth = 0): Generator<any> {
  if (!value || typeof value !== 'object' || depth > 6) return;

  if (Array.isArray(value)) {
    for (const item of value) yield* walkNodes(item, depth + 1);
    return;
  }

  yield value;

  for (const key of Object.keys(value)) {
    const child = value[key];
    if (child && typeof child === 'object') {
      yield* walkNodes(child, depth + 1);
    }
  }
}

function typeMatches(node: any): string | null {
  const rawType = node['@type'];
  if (!rawType) return null;
  const types = Array.isArray(rawType) ? rawType : [rawType];
  for (const t of types) {
    if (typeof t === 'string' && BUSINESS_TYPES.has(t.toLowerCase())) return t;
  }
  return null;
}

/** schema.org values may be a string, an object with `url`/`@id`, or an array of either. */
function toUrlList(value: any): string[] {
  if (!value) return [];
  const items = Array.isArray(value) ? value : [value];
  const urls: string[] = [];

  for (const item of items) {
    if (typeof item === 'string') {
      urls.push(item);
    } else if (item && typeof item === 'object') {
      const candidate = item.url || item.contentUrl || item['@id'];
      if (typeof candidate === 'string') urls.push(candidate);
    }
  }

  return urls.filter((u) => typeof u === 'string' && u.length > 0);
}

function toStringValue(value: any): string | undefined {
  if (typeof value === 'string') return value.trim() || undefined;
  if (typeof value === 'number') return String(value);
  if (Array.isArray(value)) {
    for (const item of value) {
      const resolved = toStringValue(item);
      if (resolved) return resolved;
    }
    return undefined;
  }
  if (value && typeof value === 'object') {
    return toStringValue(value.name ?? value.url ?? value['@id']);
  }
  return undefined;
}

/**
 * `potentialAction` carries OrderAction / ReserveAction targets, which is where
 * Toast / OpenTable / Resy links live on most restaurant sites.
 */
function extractActionUrl(node: any, actionType: string): string | undefined {
  const actions = node.potentialAction;
  if (!actions) return undefined;
  const list = Array.isArray(actions) ? actions : [actions];

  for (const action of list) {
    if (!action || typeof action !== 'object') continue;
    const rawType = action['@type'];
    const types = Array.isArray(rawType) ? rawType : [rawType];
    if (!types.some((t: any) => typeof t === 'string' && t.toLowerCase() === actionType.toLowerCase())) {
      continue;
    }

    const target = action.target;
    const urls = toUrlList(target);
    if (urls.length > 0) return urls[0];
    if (target && typeof target === 'object' && typeof target.urlTemplate === 'string') {
      return target.urlTemplate;
    }
  }

  return undefined;
}

/**
 * Extract the first business-like node from a page's JSON-LD and normalize
 * the fields we care about. Returns null when the page has no business node.
 */
export function extractStructuredBusiness(html: string): IStructuredBusiness | null {
  const blocks = extractJsonLdBlocks(html);
  if (blocks.length === 0) return null;

  for (const block of blocks) {
    for (const node of walkNodes(block)) {
      const matchedType = typeMatches(node);
      if (!matchedType) continue;

      const images = toUrlList(node.image ?? node.photo ?? node.logo);
      const cuisine = node.servesCuisine
        ? (Array.isArray(node.servesCuisine) ? node.servesCuisine : [node.servesCuisine])
          .filter((c: any) => typeof c === 'string')
        : undefined;

      const email = toStringValue(node.email)?.replace(/^mailto:/i, '');

      const result: IStructuredBusiness = {
        matchedType,
        name: toStringValue(node.name),
        image: images.length > 0 ? images : undefined,
        telephone: toStringValue(node.telephone),
        email,
        menuUrl: toStringValue(node.menu ?? node.hasMenu),
        orderUrl: extractActionUrl(node, 'OrderAction'),
        reservationUrl: extractActionUrl(node, 'ReserveAction'),
        priceRange: toStringValue(node.priceRange),
        servesCuisine: cuisine && cuisine.length > 0 ? cuisine : undefined,
        openingHours: node.openingHoursSpecification ?? node.openingHours,
      };

      // Only treat this as a hit if the node actually carried something useful.
      const hasAnyField = Object.entries(result)
        .some(([key, value]) => key !== 'matchedType' && key !== 'name' && value !== undefined);
      if (hasAnyField) return result;
    }
  }

  return null;
}
