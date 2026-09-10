/**
 * Website crawling for image extraction.
 * Extracts the best representative image from a business website.
 *
 * Candidates are returned in priority order and the caller tries each until one
 * passes dimension validation, so a broad candidate list costs nothing when the
 * first choice is good and rescues pages where it is not.
 */
import { fetchHtml, normalizeUrl } from '../utils/httpFetch';
import { extractStructuredBusiness } from './jsonLd';

export type ImageSource =
  | 'json-ld'
  | 'og'
  | 'twitter'
  | 'image_src'
  | 'body'
  | 'background'
  | 'touch-icon'
  | 'secondary-page';

export interface ICrawlResult {
  imageUrl: string;
  source: ImageSource;
}

// Domains/patterns that indicate junk images (tracking pixels, ads, placeholders)
const JUNK_PATTERNS = [
  /facebook\.com\/tr/i,
  /google-analytics\.com/i,
  /googletagmanager\.com/i,
  /doubleclick\.net/i,
  /pixel\./i,
  /tracking\./i,
  /1x1\./i,
  /spacer\./i,
  /placeholder/i,
  /\.gif(\?|$)/i,
  /\.svg(\?|$)/i,
  /data:image/i,
  /gravatar\.com/i,
  /wp-content\/plugins/i,
];

// Pages worth a second look when the homepage yields nothing usable. Ordered by
// how likely they are to carry a real photo of the business.
const SECONDARY_PATHS = ['/about', '/about-us', '/menu', '/gallery', '/photos', '/our-story'];

function isJunkUrl(url: string): boolean {
  return JUNK_PATTERNS.some((pattern) => pattern.test(url));
}

/**
 * Resolve a possibly-relative URL against a base URL.
 */
function resolveImageUrl(base: string, relative: string): string {
  try {
    return new URL(relative, base).href;
  } catch {
    return '';
  }
}

/**
 * Extract OG image from HTML.
 */
function extractOgImage(html: string): string | null {
  const match = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)
    || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
  return match?.[1] || null;
}

/**
 * Extract Twitter image from HTML.
 */
function extractTwitterImage(html: string): string | null {
  const match = html.match(/<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i)
    || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image["']/i);
  return match?.[1] || null;
}

/**
 * Extract the legacy `<link rel="image_src">` hint, still emitted by older CMSs.
 */
function extractLinkImageSrc(html: string): string | null {
  const match = html.match(/<link[^>]+rel=["']image_src["'][^>]+href=["']([^"']+)["']/i)
    || html.match(/<link[^>]+href=["']([^"']+)["'][^>]+rel=["']image_src["']/i);
  return match?.[1] || null;
}

/**
 * Extract apple-touch-icon / large PNG favicons. These are a weak last resort —
 * usually a logo rather than a photo — but a logo still beats a blank card, and
 * they are reliably >= 180x180 so they clear validation.
 */
function extractTouchIcons(html: string): string[] {
  const results: string[] = [];
  const linkRegex = /<link[^>]+>/gi;
  let match: RegExpExecArray | null;

  // eslint-disable-next-line no-cond-assign
  while ((match = linkRegex.exec(html)) !== null) {
    const tag = match[0];
    const relMatch = tag.match(/rel=["']([^"']+)["']/i);
    if (!relMatch) continue;
    const rel = relMatch[1].toLowerCase();
    if (!rel.includes('apple-touch-icon') && !rel.includes('icon')) continue;

    const hrefMatch = tag.match(/href=["']([^"']+)["']/i);
    if (!hrefMatch) continue;
    const href = hrefMatch[1];
    // .ico files can't be validated by our header parser; skip them.
    if (/\.ico(\?|$)/i.test(href) || isJunkUrl(href)) continue;

    const sizesMatch = tag.match(/sizes=["']?(\d+)x(\d+)/i);
    const size = sizesMatch ? parseInt(sizesMatch[1], 10) : 0;
    results.push(href);
    // Prefer explicitly large icons by pushing them to the front.
    if (size >= 180) results.unshift(results.pop() as string);
  }

  return results;
}

/**
 * Pick the largest URL out of a `srcset` attribute value.
 * Format: "img-480.jpg 480w, img-1024.jpg 1024w" (or "2x" density descriptors).
 */
function largestFromSrcset(srcset: string): string | null {
  const entries = srcset.split(',')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const [url, descriptor] = part.split(/\s+/);
      const width = descriptor?.endsWith('w') ? parseInt(descriptor, 10) : 0;
      const density = descriptor?.endsWith('x') ? parseFloat(descriptor) * 1000 : 0;
      return { url, weight: width || density };
    })
    .filter((e) => e.url);

  if (entries.length === 0) return null;
  entries.sort((a, b) => b.weight - a.weight);
  return entries[0].url;
}

/**
 * Extract candidate <img> tags from HTML body, sorted by estimated size (largest first).
 *
 * Handles lazy-loading attributes (`data-src`, `data-lazy-src`, `data-original`)
 * and `srcset`. Lazy loading is now the norm on hosted site builders, and a
 * plain `src=` read misses those images entirely — on those pages the real photo
 * sits in a data attribute while `src` holds a 1x1 placeholder.
 */
function extractBodyImages(html: string): string[] {
  const imgRegex = /<img[^>]+>/gi;
  const candidates: { src: string; area: number }[] = [];

  let match: RegExpExecArray | null;
  // eslint-disable-next-line no-cond-assign
  while ((match = imgRegex.exec(html)) !== null) {
    const tag = match[0];

    // Prefer the highest-resolution source available on the tag.
    const srcsetMatch = tag.match(/(?:data-)?srcset=["']([^"']+)["']/i);
    const lazyMatch = tag.match(/data-(?:src|lazy-src|original|lazy)=["']([^"']+)["']/i);
    const srcMatch = tag.match(/\ssrc=["']([^"']+)["']/i);

    const src = (srcsetMatch && largestFromSrcset(srcsetMatch[1]))
      || lazyMatch?.[1]
      || srcMatch?.[1];
    if (!src || isJunkUrl(src)) continue;

    // Try to get dimensions from attributes
    const widthMatch = tag.match(/\bwidth=["']?(\d+)/i);
    const heightMatch = tag.match(/\bheight=["']?(\d+)/i);
    const width = widthMatch ? parseInt(widthMatch[1], 10) : 0;
    const height = heightMatch ? parseInt(heightMatch[1], 10) : 0;

    // Skip tiny images (icons, logos under threshold)
    if ((width > 0 && width < 100) || (height > 0 && height < 100)) continue;

    const area = width && height ? width * height : 0;
    candidates.push({ src, area });
  }

  // Sort: images with known large dimensions first, then unknowns
  candidates.sort((a, b) => b.area - a.area);

  return candidates.map((c) => c.src);
}

/**
 * Extract `background-image: url(...)` values from inline styles. Hero images on
 * site builders are frequently CSS backgrounds with no <img> tag at all.
 */
function extractBackgroundImages(html: string): string[] {
  const results: string[] = [];
  const bgRegex = /background(?:-image)?\s*:\s*url\((['"]?)([^)'"]+)\1\)/gi;

  let match: RegExpExecArray | null;
  // eslint-disable-next-line no-cond-assign
  while ((match = bgRegex.exec(html)) !== null) {
    const src = match[2].trim();
    if (src && !isJunkUrl(src)) results.push(src);
  }

  return results;
}

/**
 * Collect image candidates from a single page's HTML, in priority order.
 */
function collectFromHtml(html: string, baseUrl: string): ICrawlResult[] {
  const candidates: ICrawlResult[] = [];
  const seen = new Set<string>();

  const push = (rawUrl: string | null | undefined, source: ImageSource) => {
    if (!rawUrl || isJunkUrl(rawUrl)) return;
    const resolved = resolveImageUrl(baseUrl, rawUrl);
    if (!resolved || seen.has(resolved)) return;
    seen.add(resolved);
    candidates.push({ imageUrl: resolved, source });
  };

  // 1. schema.org JSON-LD image — the business's own declared photo.
  const structured = extractStructuredBusiness(html);
  for (const img of structured?.image || []) {
    push(img, 'json-ld');
  }

  // 2. Social preview images, intentionally chosen by the business.
  push(extractOgImage(html), 'og');
  push(extractTwitterImage(html), 'twitter');
  push(extractLinkImageSrc(html), 'image_src');

  // 3. Body images, largest first.
  for (const imgSrc of extractBodyImages(html).slice(0, 6)) {
    push(imgSrc, 'body');
  }

  // 4. CSS hero backgrounds.
  for (const bgSrc of extractBackgroundImages(html).slice(0, 4)) {
    push(bgSrc, 'background');
  }

  // 5. Weak fallback: large touch icons / logos.
  for (const icon of extractTouchIcons(html).slice(0, 2)) {
    push(icon, 'touch-icon');
  }

  return candidates;
}

export interface ICrawlOptions {
  /**
   * When the homepage yields no candidates, try a few common interior pages.
   * Costs extra requests, so it is opt-in per call site.
   */
  followSecondaryPages?: boolean;
}

/**
 * Crawl a website URL and extract candidate images in priority order.
 * Returns an array of candidates so the caller can try each until one validates.
 * Returns empty array if no suitable candidates are found.
 */
export async function crawlForImages(
  url: string,
  options: ICrawlOptions = {},
): Promise<ICrawlResult[]> {
  const page = await fetchHtml(url, { label: 'crawlImages' });
  if (!page) return [];

  // Resolve against the post-redirect URL — a site that redirects apex to www
  // (or http to https) would otherwise produce broken relative image URLs.
  const candidates = collectFromHtml(page.html, page.finalUrl);
  if (candidates.length > 0 || !options.followSecondaryPages) {
    return candidates;
  }

  // Homepage was a dead end (splash page, JS-only shell). Try interior pages.
  for (const secondaryPath of SECONDARY_PATHS) {
    let secondaryUrl: string;
    try {
      secondaryUrl = new URL(secondaryPath, normalizeUrl(page.finalUrl)).href;
    } catch {
      continue;
    }

    const secondaryPage = await fetchHtml(secondaryUrl, {
      label: 'crawlImages',
      retries: 0,
      quiet: true,
    });
    if (!secondaryPage) continue;

    const secondaryCandidates = collectFromHtml(secondaryPage.html, secondaryPage.finalUrl)
      .map((c) => ({ ...c, source: 'secondary-page' as ImageSource }));
    if (secondaryCandidates.length > 0) return secondaryCandidates;
  }

  return [];
}
