/**
 * Shared HTML fetching for the crawl sources.
 *
 * `crawl.ts`, `crawlEmails.ts`, and `searchWeb.ts` each grew their own
 * near-identical fetch-with-headers-and-retry block. They differed only in
 * timeout and log label, which meant a fix to one (e.g. rotating User-Agents)
 * silently skipped the others.
 */
import { withRetry, isTransientNetworkError } from './withRetry';

// Rotating User-Agent strings to reduce fingerprinting.
const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:125.0) Gecko/20100101 Firefox/125.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
];

export function randomUserAgent(): string {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

export interface IFetchHtmlOptions {
  timeoutMs?: number;
  retries?: number;
  /** Label used in retry/warn logs. */
  label?: string;
  /** Suppress the HTTP-status warning line (used for speculative fetches). */
  quiet?: boolean;
}

export interface IFetchHtmlResult {
  html: string;
  /** Post-redirect URL — relative links must resolve against this, not the request URL. */
  finalUrl: string;
}

/**
 * Ensure a URL has a protocol. OSM `website` tags are frequently bare domains.
 */
export function normalizeUrl(url: string): string {
  const trimmed = url.trim();
  if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
    return `https://${trimmed}`;
  }
  return trimmed;
}

/**
 * Fetch a page and return its HTML plus the post-redirect URL.
 * Returns null on any failure or non-HTML response.
 */
export async function fetchHtml(
  url: string,
  options: IFetchHtmlOptions = {},
): Promise<IFetchHtmlResult | null> {
  const {
    timeoutMs = 10000, retries = 1, label = 'fetchHtml', quiet = false,
  } = options;
  const target = normalizeUrl(url);

  try {
    const response = await withRetry(
      () => fetch(target, {
        signal: AbortSignal.timeout(timeoutMs),
        redirect: 'follow',
        headers: {
          'User-Agent': randomUserAgent(),
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
        },
      }),
      {
        retries,
        baseDelayMs: 2000,
        shouldRetry: isTransientNetworkError,
        label: `${label} ${target}`,
        log: console.warn,
      },
    );

    if (!response.ok) {
      if (!quiet) console.warn(`  [${label}] HTTP ${response.status} for ${target}`);
      return null;
    }

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('text/html') && !contentType.includes('application/xhtml')) {
      return null;
    }

    return { html: await response.text(), finalUrl: response.url || target };
  } catch (err: any) {
    if (!quiet) console.warn(`  [${label}] Error fetching ${target}: ${err.message}`);
    return null;
  }
}
