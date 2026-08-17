import { RequestHandler } from 'express';
import { getBrandContext, parseHeaders } from 'therr-js-utilities/http';
import Store from '../store';
import handleHttpError from '../utilities/handleHttpError';
import translate from '../utilities/translator';
import { IJournalEntryRow, IJournalFeedCursor, IJournalFeedRow } from '../store/JournalEntriesStore';

/**
 * The Journal: a day-grouped record of everything the user did, plus anything
 * they chose to write about it.
 *
 * FIVE SOURCES, TWO QUERIES
 *
 * Four of the sources (notes, check-ins, streak milestones, habit starts) live
 * in `habits.*` and are unioned, ordered and limited in a single query — see
 * `JournalEntriesStore.getFeed` for why merging in JS would break pagination.
 *
 * Achievements are the fifth and are fetched separately, because
 * `main.userAchievements` is brand-scoped. It has to be read through
 * `UserAchievementsStore` with an explicit brand, both because
 * `therr/no-direct-brand-scoped-table` forbids touching it directly and because
 * joining it unscoped would spill a user's Therr achievements into their
 * Friends with Habits journal. So it is merged here, in the handler, which is
 * the one place that has the brand context.
 */

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

interface IJournalFeedItem {
    id: string;
    type: string;
    occurredAt: string;
    entryDate: string;
    body: string | null;
    habitGoalId: string | null;
    goalName: string | null;
    goalEmoji: string | null;
    meta: any;
}

/** `occurredAt` is a real instant, so UTC is the right serialization. */
const toIsoDate = (value: Date | string): string => (
    typeof value === 'string' ? value : value.toISOString()
);

/**
 * Serialize a calendar day as YYYY-MM-DD.
 *
 * `entryDate` must NOT go through `toISOString`. node-pg parses a `date` column
 * into a Date at *local* midnight, so in any positive-offset timezone
 * `toISOString()` rolls it back to the previous day — a check-in logged on the
 * 14th would file under the 13th for a server running in, say, Asia/Tokyo.
 * Production runs UTC, where the two agree, which is exactly what makes this
 * the kind of bug that only appears somewhere else. Reading the local
 * components keeps the day the database stored.
 */
const toEntryDate = (value: Date | string): string => {
    if (typeof value === 'string') {
        return value.split('T')[0];
    }

    const month = `${value.getMonth() + 1}`.padStart(2, '0');
    const day = `${value.getDate()}`.padStart(2, '0');

    return `${value.getFullYear()}-${month}-${day}`;
};

/**
 * The calendar day of a real instant, in UTC.
 *
 * `toEntryDate` is for `date` columns, where node-pg hands back local midnight
 * and the local components ARE the stored day. A `timestamptz` is a different
 * thing: reading local components there makes the day depend on the server's
 * timezone, so the same achievement would file under different days on two hosts.
 * UTC is the one deterministic choice available — unlike the habits sources,
 * there is no client-resolved local date stored alongside an achievement. Under a
 * UTC server, which production is, this agrees with `toEntryDate`.
 */
const toUtcEntryDate = (value: Date | string): string => {
    const date = typeof value === 'string' ? new Date(value) : value;
    const month = `${date.getUTCMonth() + 1}`.padStart(2, '0');
    const day = `${date.getUTCDate()}`.padStart(2, '0');

    return `${date.getUTCFullYear()}-${month}-${day}`;
};

const normalizeRow = (row: IJournalFeedRow): IJournalFeedItem => ({
    id: row.id,
    type: row.type,
    occurredAt: toIsoDate(row.occurredAt),
    entryDate: toEntryDate(row.entryDate),
    body: row.body,
    habitGoalId: row.habitGoalId,
    goalName: row.goalName,
    goalEmoji: row.goalEmoji,
    meta: row.meta,
});

/**
 * Serialize a stored entry row for the write endpoints.
 *
 * Without this, create and update return `entryDate` as a full ISO instant
 * while the feed returns YYYY-MM-DD, because `entryDate` is a `date` column and
 * Express serializes the Date node-pg builds from it via `toISOString()`. The
 * same local-midnight problem `toEntryDate` exists to solve applies here: a row
 * stored as 2026-08-17 comes back as "2026-08-17T05:00:00.000Z" on a UTC-05:00
 * server and as "2026-08-16T15:00:00.000Z" on a UTC+09:00 one, so a client that
 * splits on "T" still lands on the wrong day. Clients key day-grouping on
 * `entryDate`, so the two shapes must agree — an optimistically-inserted note
 * would otherwise sit in its own phantom day group until the next refetch.
 */
const normalizeEntry = (row: IJournalEntryRow) => ({
    ...row,
    entryDate: toEntryDate(row.entryDate),
    occurredAt: toIsoDate(row.occurredAt),
});

/**
 * Compare two ids by code point, deliberately NOT with `localeCompare`.
 *
 * This has to agree with the `COLLATE "C"` comparison the SQL side uses, because
 * the two halves of the feed are ordered independently and then merged. A locale
 * collation can give punctuation variable weight, which reorders the dashes in a
 * uuid relative to code-point order and lets SQL and JS disagree about which
 * items fall after the cursor.
 */
const compareIds = (a: string, b: string): number => {
    if (a === b) {
        return 0;
    }

    return a < b ? -1 : 1;
};

/**
 * The feed cursor, `"<occurredAt ISO>|<id>"`.
 *
 * Opaque to clients — they echo `nextCursor` back as `before` and never build
 * one. It carries the id because `occurredAt` is not unique (see
 * `JournalEntriesStore.getFeed`), and a timestamp-only cursor steps past every
 * item sharing the boundary instant.
 */
const encodeCursor = (item: IJournalFeedItem): string => `${item.occurredAt}|${item.id}`;

/**
 * Split a cursor back into its parts, or return null when the timestamp half is
 * unparseable.
 *
 * Splits on the LAST separator so an id containing `|` cannot swallow the
 * timestamp. A cursor with no separator is a bare ISO timestamp from an earlier
 * build: it parses to a null id, which the store treats as timestamp-exclusive —
 * the old behaviour, so a client mid-scroll across a deploy keeps paging instead
 * of getting a 400.
 */
const parseCursor = (raw: string): IJournalFeedCursor | null => {
    const separatorIdx = raw.lastIndexOf('|');
    const occurredAt = separatorIdx > -1 ? raw.slice(0, separatorIdx) : raw;
    const id = separatorIdx > -1 ? raw.slice(separatorIdx + 1) : '';

    if (!occurredAt || Number.isNaN(Date.parse(occurredAt))) {
        return null;
    }

    return { occurredAt, id: id || null };
};

/**
 * Is this item strictly older than the cursor, under the same total order the
 * SQL side applies?
 *
 * Used for the achievements half, which is filtered here rather than in SQL. The
 * `id` leg only engages for a compound cursor; a legacy bare-ISO cursor stays
 * timestamp-exclusive, matching what the store does with it.
 */
const isBeforeCursor = (item: IJournalFeedItem, cursor: IJournalFeedCursor): boolean => {
    const delta = Date.parse(item.occurredAt) - Date.parse(cursor.occurredAt);

    if (delta !== 0) {
        return delta < 0;
    }
    if (!cursor.id) {
        return false;
    }

    return compareIds(item.id, cursor.id) < 0;
};

// READ
const getJournalFeed: RequestHandler = async (req: any, res: any) => {
    const { userId } = parseHeaders(req.headers);
    const { brandVariation } = getBrandContext(req.headers);
    const { before } = req.query;

    const requestedLimit = parseInt(req.query.limit, 10);
    const limit = Number.isFinite(requestedLimit) && requestedLimit > 0
        ? Math.min(requestedLimit, MAX_LIMIT)
        : DEFAULT_LIMIT;

    const cursor = before ? parseCursor(before) : null;

    if (before && !cursor) {
        return handleHttpError({
            res,
            message: 'before must be a cursor returned as nextCursor by this endpoint',
            statusCode: 400,
        });
    }

    try {
        // limit + 1 from each side so the merged slice can tell "there is more"
        // from "this is the end" without a second count query.
        const [habitsRows, achievements] = await Promise.all([
            Store.journalEntries.getFeed(userId, cursor, limit + 1),
            Store.userAchievements.getCompleted(brandVariation, { userId }),
        ]);

        const achievementItems: IJournalFeedItem[] = (achievements || [])
            .filter((achievement: any) => !!achievement.completedAt)
            .map((achievement: any) => ({
                id: achievement.id,
                type: 'achievement',
                occurredAt: toIsoDate(achievement.completedAt),
                // `completedAt` is a timestamptz, not a `date` column — see
                // `toUtcEntryDate` on why this does not go through `toEntryDate`.
                entryDate: toUtcEntryDate(achievement.completedAt),
                body: null,
                habitGoalId: null,
                goalName: null,
                goalEmoji: null,
                meta: {
                    achievementId: achievement.achievementId,
                    achievementClass: achievement.achievementClass,
                    achievementTier: achievement.achievementTier,
                    unclaimedRewardPts: achievement.unclaimedRewardPts,
                },
            }))
            // Applied after the mapping so the comparison runs on exactly the
            // shape the SQL side is compared on, under the same total order.
            .filter((item: IJournalFeedItem) => !cursor || isBeforeCursor(item, cursor))
            .slice(0, limit + 1);

        const merged = [...habitsRows.map(normalizeRow), ...achievementItems]
            // Same total order the SQL side and the cursor use: instant first,
            // then id by code point. The cursor carries both, so an item sharing
            // the boundary instant is paged past rather than skipped.
            .sort((a, b) => {
                const delta = Date.parse(b.occurredAt) - Date.parse(a.occurredAt);
                if (delta !== 0) {
                    return delta;
                }
                return compareIds(b.id, a.id);
            });

        const items = merged.slice(0, limit);
        const hasMore = merged.length > limit;

        return res.status(200).send({
            items,
            // (occurredAt, id) of the last returned item, exclusive — so the next
            // page neither repeats it nor steps over its timestamp neighbours.
            nextCursor: hasMore && items.length ? encodeCursor(items[items.length - 1]) : null,
            hasMore,
        });
    } catch (err: any) {
        return handleHttpError({ err, res, message: 'SQL:JOURNAL_ROUTES:ERROR' });
    }
};

// CREATE
const createJournalEntry: RequestHandler = async (req: any, res: any) => {
    const { locale, userId } = parseHeaders(req.headers);
    const {
        body, habitGoalId, checkinId, entryDate, occurredAt,
    } = req.body;

    if (!body || !String(body).trim()) {
        return handleHttpError({
            res,
            message: translate(locale, 'errorMessages.habits.journalBodyRequired'),
            statusCode: 400,
        });
    }

    // The client sends its own local date because only it knows the user's
    // timezone — `main.users.settingsTimezone` is optional and frequently
    // unset. Falling back to the server's day is better than rejecting the
    // write, but it is a fallback, not the intended path.
    const resolvedEntryDate = entryDate || new Date().toISOString().split('T')[0];

    if (!/^\d{4}-\d{2}-\d{2}$/.test(resolvedEntryDate)) {
        return handleHttpError({
            res,
            message: 'entryDate must be formatted YYYY-MM-DD',
            statusCode: 400,
        });
    }

    return Store.journalEntries.create({
        userId,
        habitGoalId: habitGoalId || null,
        checkinId: checkinId || null,
        body: String(body).trim(),
        entryDate: resolvedEntryDate,
        occurredAt: occurredAt || null,
    })
        .then((entry) => res.status(201).send(normalizeEntry(entry)))
        .catch((err) => handleHttpError({ err, res, message: 'SQL:JOURNAL_ROUTES:ERROR' }));
};

// UPDATE
const updateJournalEntry: RequestHandler = async (req: any, res: any) => {
    const { locale, userId } = parseHeaders(req.headers);
    const { id } = req.params;
    const { body, habitGoalId } = req.body;

    if (body !== undefined && !String(body).trim()) {
        return handleHttpError({
            res,
            message: translate(locale, 'errorMessages.habits.journalBodyRequired'),
            statusCode: 400,
        });
    }

    const params: { body?: string; habitGoalId?: string | null } = {};

    if (body !== undefined) {
        params.body = String(body).trim();
    }
    // `null` is meaningful here — it clears the habit tag — so the check is on
    // `undefined`, not on falsiness.
    if (habitGoalId !== undefined) {
        params.habitGoalId = habitGoalId || null;
    }

    if (!Object.keys(params).length) {
        return handleHttpError({
            res,
            message: 'Nothing to update',
            statusCode: 400,
        });
    }

    // The ownership predicate lives in the UPDATE itself, so there is no window
    // between checking and writing.
    return Store.journalEntries.update(id, userId, params)
        .then((entry) => {
            if (!entry) {
                return handleHttpError({
                    res,
                    message: translate(locale, 'errorMessages.habits.journalEntryNotFound'),
                    statusCode: 404,
                });
            }

            return res.status(200).send(normalizeEntry(entry));
        })
        .catch((err) => handleHttpError({ err, res, message: 'SQL:JOURNAL_ROUTES:ERROR' }));
};

// DELETE
const deleteJournalEntry: RequestHandler = async (req: any, res: any) => {
    const { locale, userId } = parseHeaders(req.headers);
    const { id } = req.params;

    return Store.journalEntries.delete(id, userId)
        .then((deleted) => {
            if (!deleted.length) {
                return handleHttpError({
                    res,
                    message: translate(locale, 'errorMessages.habits.journalEntryNotFound'),
                    statusCode: 404,
                });
            }

            return res.status(200).send({ id });
        })
        .catch((err) => handleHttpError({ err, res, message: 'SQL:JOURNAL_ROUTES:ERROR' }));
};

export {
    getJournalFeed,
    createJournalEntry,
    updateJournalEntry,
    deleteJournalEntry,
};
