/**
 * Website crawling for image extraction.
 * Extracts the best representative image from a business website.
 */

export interface ICrawlResult {
  imageUrl: string;
  source: 'og' | 'twitter' | 'body';
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
 * Extract candidate <img> tags from HTML body, sorted by estimated size (largest first).
 * Uses width/height attributes when available.
 */
function extractBodyImages(html: string): string[] {
  const imgRegex = /<img[^>]+>/gi;
  const candidates: { src: string; area: number }[] = [];

  let match: RegExpExecArray | null;
  // eslint-disable-next-line no-cond-assign
  while ((match = imgRegex.exec(html)) !== null) {
    const tag = match[0];
    const srcMatch = tag.match(/src=["']([^"']+)["']/i);
    if (!srcMatch) continue;

    const src = srcMatch[1];
    if (isJunkUrl(src)) continue;

    // Try to get dimensions from attributes
    const widthMatch = tag.match(/width=["']?(\d+)/i);
    const heightMatch = tag.match(/height=["']?(\d+)/i);
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
 * Crawl a website URL and extract candidate images in priority order.
 * Returns an array of candidates so the caller can try each until one validates.
 * Returns empty array if no suitable candidates are found.
 */
export async function crawlForImages(url: string): Promise<ICrawlResult[]> {
  try {
    // Ensure URL has protocol
    let normalizedUrl = url;
    if (!normalizedUrl.startsWith('http://') && !normalizedUrl.startsWith('https://')) {
      normalizedUrl = `https://${normalizedUrl}`;
    }

    const response = await fetch(normalizedUrl, {
      signal: AbortSignal.timeout(10000),
      redirect: 'follow',
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; TherSpaceBot/1.0)',
        'Accept': 'text/html',
      },
    });

    if (!response.ok) return [];

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('text/html') && !contentType.includes('application/xhtml')) return [];

    const html = await response.text();
    const candidates: ICrawlResult[] = [];

    // 1. Try OG image
    const ogImage = extractOgImage(html);
    if (ogImage && !isJunkUrl(ogImage)) {
      const resolved = resolveImageUrl(normalizedUrl, ogImage);
      if (resolved) candidates.push({ imageUrl: resolved, source: 'og' });
    }

    // 2. Try Twitter image
    const twitterImage = extractTwitterImage(html);
    if (twitterImage && !isJunkUrl(twitterImage)) {
      const resolved = resolveImageUrl(normalizedUrl, twitterImage);
      if (resolved) candidates.push({ imageUrl: resolved, source: 'twitter' });
    }

    // 3. Try body images (largest first, top 5)
    const bodyImages = extractBodyImages(html);
    for (const imgSrc of bodyImages.slice(0, 5)) {
      const resolved = resolveImageUrl(normalizedUrl, imgSrc);
      if (resolved) {
        candidates.push({ imageUrl: resolved, source: 'body' });
      }
    }

    return candidates;
  } catch {
    return [];
  }
}
