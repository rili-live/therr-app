/**
 * Tracks space IDs that have been processed for each metadata lookup type.
 *
 * Stores results in JSON files under scripts/import-spaces/data/processed/.
 * Each lookup type gets its own file so scripts can skip IDs that have already
 * been attempted (e.g., spaces where no website was found won't be re-searched).
 *
 * Files:
 *   no-website-found.json   — website search returned no results
 *   no-email-found.json     — email extraction found nothing
 *   no-image-found.json     — no valid image could be sourced
 *   website-found.json      — website was successfully discovered
 *   email-found.json        — email was successfully extracted
 *   image-found.json        — image was successfully sourced
 */
import * as fs from 'fs';
import * as path from 'path';

const DATA_DIR = path.resolve(__dirname, '..', 'data', 'processed');

export enum ProcessedType {
  NO_WEBSITE_FOUND = 'no-website-found',
  NO_EMAIL_FOUND = 'no-email-found',
  NO_IMAGE_FOUND = 'no-image-found',
  WEBSITE_FOUND = 'website-found',
  EMAIL_FOUND = 'email-found',
  IMAGE_FOUND = 'image-found',
}

interface IProcessedEntry {
  id: string;
  name: string;
  processedAt: string;
}

interface IProcessedFile {
  type: string;
  updatedAt: string;
  entries: IProcessedEntry[];
}

function ensureDataDir(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function filePath(type: ProcessedType): string {
  return path.join(DATA_DIR, `${type}.json`);
}

/**
 * In-process cache of each file's parsed contents, alongside an ID index.
 *
 * Without this, `markProcessed` re-read and re-parsed the whole file on every
 * single space. These files reach several thousand entries, so a long run spent
 * most of its non-network time re-parsing JSON it had just written.
 */
const fileCache = new Map<ProcessedType, IProcessedFile>();
const idCache = new Map<ProcessedType, Set<string>>();

/**
 * Load all entries from a processed-spaces JSON file (cached per process).
 */
function loadFile(type: ProcessedType): IProcessedFile {
  const cached = fileCache.get(type);
  if (cached) return cached;

  const fp = filePath(type);
  let data: IProcessedFile;

  if (!fs.existsSync(fp)) {
    data = { type, updatedAt: new Date().toISOString(), entries: [] };
  } else {
    try {
      const raw = fs.readFileSync(fp, 'utf-8');
      data = JSON.parse(raw) as IProcessedFile;
      if (!Array.isArray(data.entries)) data.entries = [];
    } catch (err) {
      console.error(`Warning: Could not parse ${fp}, starting fresh. Error: ${(err as Error).message}`);
      data = { type, updatedAt: new Date().toISOString(), entries: [] };
    }
  }

  fileCache.set(type, data);
  idCache.set(type, new Set(data.entries.map((e) => e.id)));
  return data;
}

/**
 * Save a processed-spaces file back to disk.
 */
function saveFile(data: IProcessedFile): void {
  ensureDataDir();
  const fp = path.join(DATA_DIR, `${data.type}.json`);
  data.updatedAt = new Date().toISOString();
  fs.writeFileSync(fp, `${JSON.stringify(data, null, 2)}\n`, 'utf-8');
}

/**
 * Load the set of all processed space IDs for a given type.
 */
export function loadProcessedIds(type: ProcessedType): Set<string> {
  loadFile(type);
  return idCache.get(type) as Set<string>;
}

/**
 * Load processed IDs from multiple types and return the union.
 */
export function loadProcessedIdsMulti(types: ProcessedType[]): Set<string> {
  const combined = new Set<string>();
  for (const type of types) {
    for (const id of loadProcessedIds(type)) {
      combined.add(id);
    }
  }
  return combined;
}

/**
 * Mark a single space ID as processed for a given type.
 */
export function markProcessed(type: ProcessedType, id: string, name: string): void {
  const data = loadFile(type);
  const ids = idCache.get(type) as Set<string>;
  // Avoid duplicates
  if (ids.has(id)) return;

  data.entries.push({
    id,
    name,
    processedAt: new Date().toISOString(),
  });
  ids.add(id);
  saveFile(data);
}

/**
 * Mark multiple space IDs as processed for a given type in a single write.
 */
export function markProcessedBatch(type: ProcessedType, items: Array<{ id: string; name: string }>): void {
  if (items.length === 0) return;

  const data = loadFile(type);
  const existing = idCache.get(type) as Set<string>;
  const now = new Date().toISOString();

  for (const item of items) {
    if (!existing.has(item.id)) {
      data.entries.push({ id: item.id, name: item.name, processedAt: now });
      existing.add(item.id);
    }
  }

  saveFile(data);
}

/**
 * Clear a processed-spaces file entirely.
 *
 * Needed whenever the extraction logic improves: the prior run recorded
 * thousands of "no image found" IDs that a better extractor would now succeed
 * on, and without a reset those spaces are skipped forever.
 *
 * Returns the number of entries removed.
 */
export function resetProcessed(type: ProcessedType): number {
  const data = loadFile(type);
  const removed = data.entries.length;
  data.entries = [];
  (idCache.get(type) as Set<string>).clear();
  saveFile(data);
  return removed;
}

/**
 * Processed IDs for the given types as a plain array, for use as a Postgres
 * query parameter (`id != ALL($n::uuid[])`).
 *
 * Excluding in SQL rather than in JS is what makes `--limit N` mean "N spaces
 * I have not tried yet". Filtering after the query applied its LIMIT meant a
 * run asking for 50 spaces would sample 50 rows at random from the whole
 * eligible set — most of which were already processed — and then do almost
 * nothing, which looks identical to the script being broken.
 */
export function processedIdsArray(types: ProcessedType[]): string[] {
  return Array.from(loadProcessedIdsMulti(types));
}

/**
 * Filter an array of spaces, removing any whose ID appears in the given
 * processed types. Returns the filtered array and the count of skipped items.
 */
export function filterProcessedSpaces<T extends { id: string }>(
  spaces: T[],
  types: ProcessedType[],
): { filtered: T[]; skippedCount: number } {
  const processedIds = loadProcessedIdsMulti(types);
  const filtered = spaces.filter((s) => !processedIds.has(s.id));
  return {
    filtered,
    skippedCount: spaces.length - filtered.length,
  };
}

/**
 * Get summary stats for all processed-spaces files.
 */
export function getProcessedStats(): Record<string, number> {
  const stats: Record<string, number> = {};
  for (const type of Object.values(ProcessedType)) {
    const data = loadFile(type);
    stats[type] = data.entries.length;
  }
  return stats;
}
