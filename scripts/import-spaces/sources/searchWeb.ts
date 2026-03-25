/**
 * Lightweight web search to find a business website given its name and location.
 * Uses Bing HTML search with DuckDuckGo as fallback (no API key required).
 *
 * Only returns a result when confidence is high — the discovered page title or
 * domain must clearly match the business name, so we don't associate the wrong
 * website with a space.
 */

// Social media, directory, and review sites that are never a business's own website
const REJECT_DOMAINS = [
  'facebook.com',
  'instagram.com',
  'twitter.com',
  'x.com',
  'linkedin.com',
  'yelp.com',
  'tripadvisor.com',
  'foursquare.com',
  'yellowpages.com',
  'bbb.org',
  'mapquest.com',
  'google.com',
  'apple.com',
  'grubhub.com',
  'doordash.com',
  'ubereats.com',
  'opentable.com',
  'seamless.com',
  'postmates.com',
  'wikipedia.org',
  'wikidata.org',
  'pinterest.com',
  'tiktok.com',
  'youtube.com',
  'nextdoor.com',
  'menulog.com',
  'zomato.com',
  'allmenus.com',
  'chamberofcommerce.com',
  'manta.com',
  'superpages.com',
  'whitepages.com',
  'duckduckgo.com',
  'bing.com',
];

/**
 * Clean and validate a discovered URL — ensure it looks like a real business website.
 */
function isLikelyBusinessWebsite(url: string): boolean {
  try {
    const hostname = new URL(url).hostname.replace(/^www\./, '');
    return !REJECT_DOMAINS.some((d) => hostname === d || hostname.endsWith(`.${d}`));
  } catch {
    return false;
  }
}

/**
 * Normalize a string for fuzzy matching: lowercase, remove punctuation, collapse whitespace.
 */
function normalize(str: string): string {
  return str
    .toLowerCase()
    .replace(/[''`]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Check if the business name is a confident match against a domain or page title.
 * We require that a substantial portion of the business name words appear in the target.
 */
function isConfidentMatch(businessName: string, domain: string, pageTitle?: string): boolean {
  const nameNorm = normalize(businessName);
  const nameWords = nameNorm.split(' ').filter((w) => w.length > 2); // skip tiny words like "of", "the", "a"

  if (nameWords.length === 0) return false;

  // Check 1: Does the domain contain the business name (collapsed)?
  // e.g., "Joe's Pizza" → "joespizza" vs domain "joespizza.com"
  const nameCollapsed = nameNorm.replace(/\s+/g, '');
  const domainBase = domain.replace(/^www\./, '').split('.')[0].toLowerCase();
  if (domainBase.includes(nameCollapsed) || nameCollapsed.includes(domainBase)) {
    return true;
  }

  // Check 2: Do most business name words appear in the domain?
  const domainNorm = domain.toLowerCase().replace(/[^a-z0-9]/g, '');
  let domainHits = 0;
  for (const word of nameWords) {
    if (domainNorm.includes(word)) domainHits++;
  }
  if (domainHits >= Math.ceil(nameWords.length * 0.6)) {
    return true;
  }

  // Check 3: Does the page title contain most of the business name words?
  if (pageTitle) {
    const titleNorm = normalize(pageTitle);
    let titleHits = 0;
    for (const word of nameWords) {
      if (titleNorm.includes(word)) titleHits++;
    }
    if (titleHits >= Math.ceil(nameWords.length * 0.6)) {
      return true;
    }
  }

  return false;
}

interface ISearchResult {
  url: string;
  title: string;
}

// Rotating User-Agent strings to reduce fingerprinting
const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:125.0) Gecko/20100101 Firefox/125.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
];

function randomUserAgent(): string {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

/**
 * Extract URLs and titles from Bing HTML search results.
 * Uses two strategies to handle Bing's varying HTML structures:
 * 1. Match <h2> links inside b_algo containers (standard layout)
 * 2. Fall back to matching <cite> URLs paired with nearby <h2> links
 */
function extractBingResults(html: string): ISearchResult[] {
  const results: ISearchResult[] = [];
  const seenUrls = new Set<string>();

  // Strategy 1: Match <li class="b_algo ..."> blocks containing <h2><a href="...">
  // The class list may contain additional classes (b_algo_group, etc.)
  const algoBlockRegex = /<li[^>]*\bclass="[^"]*\bb_algo\b[^"]*"[^>]*>([\s\S]*?)<\/li>/gi;
  let blockMatch: RegExpExecArray | null;

  // eslint-disable-next-line no-cond-assign
  while ((blockMatch = algoBlockRegex.exec(html)) !== null) {
    const block = blockMatch[1];
    const linkMatch = block.match(/<h2[^>]*>\s*<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/i);
    if (!linkMatch) continue;

    const href = linkMatch[1];
    const title = linkMatch[2].replace(/<[^>]+>/g, '').trim();

    if ((href.startsWith('http://') || href.startsWith('https://')) && !seenUrls.has(href)) {
      seenUrls.add(href);
      results.push({ url: href, title });
    }
  }

  // Strategy 2: If no results from block matching, try a flatter <h2><a> pattern
  // (handles cases where Bing restructures the container elements)
  if (results.length === 0) {
    const flatRegex = /<h2[^>]*>\s*<a[^>]+href=["'](https?:\/\/[^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
    let flatMatch: RegExpExecArray | null;

    // eslint-disable-next-line no-cond-assign
    while ((flatMatch = flatRegex.exec(html)) !== null) {
      const href = flatMatch[1];
      const title = flatMatch[2].replace(/<[^>]+>/g, '').trim();

      if (!seenUrls.has(href)) {
        seenUrls.add(href);
        results.push({ url: href, title });
      }
    }
  }

  return results;
}

/**
 * Extract URLs and titles from DuckDuckGo HTML search results.
 */
function extractDdgResults(html: string): ISearchResult[] {
  const results: ISearchResult[] = [];

  // DuckDuckGo HTML results: <a class="result__a" href="...">Title</a>
  const resultRegex = /class="result__a"[^>]*href=["']([^"']+)["'][^>]*>([^<]*)</gi;
  let match: RegExpExecArray | null;

  // eslint-disable-next-line no-cond-assign
  while ((match = resultRegex.exec(html)) !== null) {
    let href = match[1];
    const title = match[2].trim();

    // DDG wraps results in a redirect: //duckduckgo.com/l/?uddg=<url>&...
    if (href.includes('uddg=')) {
      const uddgMatch = href.match(/uddg=([^&]+)/);
      if (uddgMatch) {
        href = decodeURIComponent(uddgMatch[1]);
      }
    }

    if (href.startsWith('http://') || href.startsWith('https://')) {
      results.push({ url: href, title });
    }
  }

  return results;
}

/**
 * Perform a web search using Bing, with DuckDuckGo as fallback.
 * Includes retry logic with exponential backoff.
 */
async function webSearch(query: string): Promise<ISearchResult[]> {
  // Try Bing first (more tolerant of programmatic access)
  const bingUrl = `https://www.bing.com/search?q=${encodeURIComponent(query)}&setlang=en`;
  try {
    const response = await fetch(bingUrl, {
      signal: AbortSignal.timeout(10000),
      redirect: 'follow',
      headers: {
        'User-Agent': randomUserAgent(),
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    });

    if (response.ok) {
      const html = await response.text();
      const results = extractBingResults(html);
      if (results.length > 0) return results;
    } else {
      console.warn(`  [searchWeb] Bing returned HTTP ${response.status}`);
    }
  } catch (err: any) {
    console.warn(`  [searchWeb] Bing error: ${err.message}`);
  }

  // Fallback to DuckDuckGo with retry + backoff
  const ddgUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
  const maxRetries = 2;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (attempt > 0) {
      const backoff = 2000 * Math.pow(2, attempt - 1) + Math.random() * 1000;
      console.warn(`  [searchWeb] DDG retry ${attempt}/${maxRetries}, waiting ${Math.round(backoff)}ms...`);
      await new Promise((resolve) => { setTimeout(resolve, backoff); });
    }

    try {
      const response = await fetch(ddgUrl, {
        signal: AbortSignal.timeout(10000),
        redirect: 'follow',
        headers: {
          'User-Agent': randomUserAgent(),
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
        },
      });

      if (response.ok) {
        const html = await response.text();
        return extractDdgResults(html);
      }

      if (response.status !== 403) {
        console.warn(`  [searchWeb] DuckDuckGo returned HTTP ${response.status}`);
        return [];
      }
      // 403 = rate limited, retry
    } catch (err: any) {
      console.warn(`  [searchWeb] DDG error: ${err.message}`);
      return [];
    }
  }

  console.warn('  [searchWeb] All search engines exhausted');
  return [];
}

/**
 * Fetch the <title> tag from a URL for secondary verification.
 */
async function fetchPageTitle(url: string): Promise<string | null> {
  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(8000),
      redirect: 'follow',
      headers: {
        'User-Agent': randomUserAgent(),
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    });

    if (!response.ok) return null;

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('text/html') && !contentType.includes('application/xhtml')) return null;

    const html = await response.text();
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    return titleMatch?.[1]?.trim() || null;
  } catch {
    return null;
  }
}

export interface IWebSearchResult {
  websiteUrl: string;
  confidence: 'high' | 'medium';
  matchedOn: string;
}

/**
 * Search for a business website using Bing (with DuckDuckGo fallback).
 * Only returns a result when we have high confidence the URL belongs to this business.
 *
 * Confidence checks:
 * 1. The search result's domain or title must match the business name
 * 2. The actual page <title> is fetched to double-check (avoids stale/wrong search snippets)
 *
 * @param businessName - The name of the business
 * @param city - The city (for location context)
 * @param region - The state/region (for location context)
 */
export async function searchForWebsite(
  businessName: string,
  city: string,
  region: string,
): Promise<IWebSearchResult | null> {
  try {
    const query = `${businessName} ${city} ${region} official website`;
    const searchResults = await webSearch(query);

    // Only check the top 3 results to avoid false positives from lower-ranked results
    const candidateResults = searchResults.filter((r) => isLikelyBusinessWebsite(r.url)).slice(0, 3);

    for (const candidate of candidateResults) {
      let domain = '';
      try {
        domain = new URL(candidate.url).hostname;
      } catch {
        continue;
      }

      // Check 1: Does the search result title/domain match the business name?
      if (isConfidentMatch(businessName, domain, candidate.title)) {
        // Check 2: Verify by fetching the actual page title
        const pageTitle = await fetchPageTitle(candidate.url);
        if (pageTitle && isConfidentMatch(businessName, domain, pageTitle)) {
          return {
            websiteUrl: candidate.url,
            confidence: 'high',
            matchedOn: `domain+title: ${domain} / "${pageTitle}"`,
          };
        }

        // If page title fetch failed but domain strongly matches, still accept
        const nameCollapsed = normalize(businessName).replace(/\s+/g, '');
        const domainBase = domain.replace(/^www\./, '').split('.')[0].toLowerCase();
        if (domainBase.includes(nameCollapsed) || nameCollapsed.includes(domainBase)) {
          return {
            websiteUrl: candidate.url,
            confidence: 'medium',
            matchedOn: `domain: ${domain}`,
          };
        }
      }
    }

    return null;
  } catch {
    return null;
  }
}
