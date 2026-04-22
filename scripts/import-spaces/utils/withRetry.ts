/**
 * Generalized exponential-backoff retry wrapper for transient network failures.
 *
 * Extracted from `sources/osm.ts` so crawl/search/SES calls can opt into the
 * same behavior. Default is no retries — wrap call sites explicitly.
 */

export interface IWithRetryOptions {
  /** Total attempts beyond the first (default: 0 → no retry). */
  retries?: number;
  /** Initial backoff in ms; doubled each attempt. */
  baseDelayMs?: number;
  /** Cap on any single backoff. */
  maxDelayMs?: number;
  /** Predicate to decide whether an error is worth retrying. Defaults to all errors. */
  shouldRetry?: (err: unknown, attempt: number) => boolean;
  /** Optional logger; no-op by default. */
  log?: (msg: string) => void;
  /** Label used in log messages (e.g. "crawl"). */
  label?: string;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => { setTimeout(resolve, ms); });
}

/**
 * Run `fn` up to `retries + 1` times with exponential backoff between attempts.
 * The final error is re-thrown when all attempts are exhausted.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: IWithRetryOptions = {},
): Promise<T> {
  const {
    retries = 0,
    baseDelayMs = 1000,
    maxDelayMs = 30000,
    shouldRetry = () => true,
    log,
    label,
  } = options;

  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (attempt >= retries || !shouldRetry(err, attempt)) {
        throw err;
      }
      const delay = Math.min(baseDelayMs * Math.pow(2, attempt), maxDelayMs);
      if (log) {
        const prefix = label ? `[${label}] ` : '';
        const message = err instanceof Error ? err.message : String(err);
        log(`${prefix}attempt ${attempt + 1}/${retries + 1} failed: ${message}. Retrying in ${delay}ms…`);
      }
      await sleep(delay);
    }
  }

  throw lastError;
}

/**
 * Default predicate: retry on network errors and 5xx-ish fetch failures, not on 4xx.
 * Callers pass it explicitly via `shouldRetry` when useful.
 */
export function isTransientNetworkError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const msg = err.message.toLowerCase();
  return (
    msg.includes('network')
    || msg.includes('timeout')
    || msg.includes('econnreset')
    || msg.includes('etimedout')
    || msg.includes('enotfound')
    || msg.includes('socket hang up')
    || msg.includes('eai_again')
    // Match HTTP 5xx only when clearly framed as a status, not any 3-digit number.
    || /\bhttp\s*5\d\d\b/.test(msg)
    || /\bstatus(?:\s*(?:code)?)?[:\s]+5\d\d\b/.test(msg)
    || /\b5\d\d\s+(?:server|bad gateway|service unavailable|gateway timeout|internal server error)\b/.test(msg)
  );
}
