/**
 * Website crawling for email extraction.
 * Extracts business email addresses from a website by checking mailto links,
 * plaintext patterns, and optionally following a contact page.
 */
import { fetchHtml, normalizeUrl } from '../utils/httpFetch';
import { extractStructuredBusiness } from './jsonLd';

export interface IEmailCrawlResult {
  email: string;
  source: 'json-ld' | 'mailto' | 'text' | 'contact-page-mailto' | 'contact-page-text';
}

// Generic/junk email domains to reject
const JUNK_EMAIL_DOMAINS = [
  'facebook.com',
  'google.com',
  'gmail.com',
  'yelp.com',
  'instagram.com',
  'twitter.com',
  'youtube.com',
  'linkedin.com',
  'tripadvisor.com',
  'wix.com',
  'squarespace.com',
  'wordpress.com',
  'wordpress.org',
  'w3.org',
  'schema.org',
  'example.com',
  'sentry.io',
  'cloudflare.com',
];

// Prefixes that indicate automated/noreply addresses
const JUNK_EMAIL_PREFIXES = [
  'noreply',
  'no-reply',
  'no_reply',
  'donotreply',
  'do-not-reply',
  'mailer-daemon',
  'postmaster',
  'hostmaster',
  'webmaster',
  'abuse',
  'root',
  'admin@wix',
  'admin@squarespace',
];

// Patterns that indicate false positives from image filenames or CSS
const FALSE_POSITIVE_PATTERNS = [
  /@2x\b/i,
  /@3x\b/i,
  /@4x\b/i,
  /\.(png|jpg|jpeg|gif|svg|webp|css|js)$/i,
];

const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

function isJunkEmail(email: string): boolean {
  const lower = email.toLowerCase();
  const domain = lower.split('@')[1];

  if (JUNK_EMAIL_DOMAINS.some((d) => domain === d)) return true;
  if (JUNK_EMAIL_PREFIXES.some((p) => lower.startsWith(p))) return true;
  if (FALSE_POSITIVE_PATTERNS.some((p) => p.test(lower))) return true;
  // Reject emails with very long local parts (likely encoded strings)
  if (lower.split('@')[0].length > 64) return true;

  return false;
}

/**
 * Extract emails from mailto: links in HTML.
 */
function extractMailtoEmails(html: string): string[] {
  const results: string[] = [];
  const mailtoRegex = /href=["']mailto:([^"'?]+)/gi;
  let match: RegExpExecArray | null;

  // eslint-disable-next-line no-cond-assign
  while ((match = mailtoRegex.exec(html)) !== null) {
    const email = decodeURIComponent(match[1]).trim().toLowerCase();
    if (email.includes('@') && !isJunkEmail(email)) {
      results.push(email);
    }
  }

  return results;
}

/**
 * Strip HTML tags and extract emails from plaintext content.
 */
function extractTextEmails(html: string): string[] {
  // Remove script/style blocks, then strip tags
  const stripped = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ');

  const results: string[] = [];
  let match: RegExpExecArray | null;

  // eslint-disable-next-line no-cond-assign
  while ((match = EMAIL_REGEX.exec(stripped)) !== null) {
    const email = match[0].toLowerCase();
    if (!isJunkEmail(email)) {
      results.push(email);
    }
  }

  return results;
}

/**
 * Find a contact or about page URL in the HTML.
 */
function findContactPageUrl(html: string, baseUrl: string): string | null {
  const patterns = [
    /href=["']([^"']*\/contact(?:-us)?[^"']*)["']/gi,
    /href=["']([^"']*\/about(?:-us)?[^"']*)["']/gi,
    /href=["']([^"']*\/kontakt[^"']*)["']/gi,
    /href=["']([^"']*\/contacto[^"']*)["']/gi,
  ];

  for (const pattern of patterns) {
    const match = pattern.exec(html);
    if (match) {
      try {
        return new URL(match[1], baseUrl).href;
      } catch {
        // Invalid URL, skip
      }
    }
  }

  return null;
}

/**
 * Deduplicate emails (case-insensitive) and prioritize those matching the website domain.
 */
function rankEmails(
  emails: { email: string; source: IEmailCrawlResult['source'] }[],
  websiteDomain: string,
): IEmailCrawlResult[] {
  const seen = new Set<string>();
  const unique: IEmailCrawlResult[] = [];

  for (const entry of emails) {
    const lower = entry.email.toLowerCase();
    if (!seen.has(lower)) {
      seen.add(lower);
      unique.push({ email: lower, source: entry.source });
    }
  }

  // Sort: domain-matching emails first, then by source priority.
  // JSON-LD outranks everything — it is the business's own declared address,
  // not something inferred from page text.
  const sourcePriority: Record<string, number> = {
    'json-ld': 0,
    mailto: 1,
    'contact-page-mailto': 2,
    text: 3,
    'contact-page-text': 4,
  };

  unique.sort((a, b) => {
    const aDomainMatch = a.email.endsWith(`@${websiteDomain}`) ? 0 : 1;
    const bDomainMatch = b.email.endsWith(`@${websiteDomain}`) ? 0 : 1;
    if (aDomainMatch !== bDomainMatch) return aDomainMatch - bDomainMatch;
    return (sourcePriority[a.source] || 99) - (sourcePriority[b.source] || 99);
  });

  return unique.slice(0, 3);
}

/**
 * Crawl a website URL and extract email addresses.
 * Returns ranked candidates (best first), or empty array if none found.
 */
export async function crawlForEmails(url: string): Promise<IEmailCrawlResult[]> {
  try {
    const normalizedUrl = normalizeUrl(url);

    let websiteDomain = '';
    try {
      websiteDomain = new URL(normalizedUrl).hostname.replace(/^www\./, '');
    } catch {
      return [];
    }

    const page = await fetchHtml(normalizedUrl, { label: 'crawlEmails' });
    if (!page) return [];
    const { html } = page;

    const allEmails: { email: string; source: IEmailCrawlResult['source'] }[] = [];

    // Step 1: schema.org JSON-LD email — declared by the business itself.
    const structuredEmail = extractStructuredBusiness(html)?.email?.toLowerCase();
    if (structuredEmail && structuredEmail.includes('@') && !isJunkEmail(structuredEmail)) {
      allEmails.push({ email: structuredEmail, source: 'json-ld' });
    }

    // Step 2: mailto links on homepage
    for (const email of extractMailtoEmails(html)) {
      allEmails.push({ email, source: 'mailto' });
    }

    // Step 3: plaintext emails on homepage
    for (const email of extractTextEmails(html)) {
      allEmails.push({ email, source: 'text' });
    }

    // Step 4: If no emails found, try the contact/about page
    if (allEmails.length === 0) {
      const contactUrl = findContactPageUrl(html, page.finalUrl);
      if (contactUrl) {
        const contactPage = await fetchHtml(contactUrl, { label: 'crawlEmails', quiet: true });
        if (contactPage) {
          for (const email of extractMailtoEmails(contactPage.html)) {
            allEmails.push({ email, source: 'contact-page-mailto' });
          }
          for (const email of extractTextEmails(contactPage.html)) {
            allEmails.push({ email, source: 'contact-page-text' });
          }
        }
      }
    }

    return rankEmails(allEmails, websiteDomain);
  } catch {
    return [];
  }
}
