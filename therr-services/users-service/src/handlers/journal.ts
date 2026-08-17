import { RequestHandler } from 'express';
import { getBrandContext, parseHeaders } from 'therr-js-utilities/http';
import Store from '../store';
import handleHttpError from '../utilities/handleHttpError';
import translate from '../utilities/translator';
import { IJournalEntryRow, IJournalFeedRow } from '../store/JournalEntriesStore';

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

// READ
const getJournalFeed: RequestHandler = async (req: any, res: any) => {
    const { userId } = parseHeaders(req.headers);
    const { brandVariation } = getBrandContext(req.headers);
    const { before } = req.query;

    const requestedLimit = parseInt(req.query.limit, 10);
    const limit = Number.isFinite(requestedLimit) && requestedLimit > 0
        ? Math.min(requestedLimit, MAX_LIMIT)
        : DEFAULT_LIMIT;

    if (before && Number.isNaN(Date.parse(before))) {
        return handleHttpError({
            res,
            message: 'before must be an ISO-8601 timestamp',
            statusCode: 400,
        });
    }

    try {
        // limit + 1 from each side so the merged slice can tell "there is more"
        // from "this is the end" without a second count query.
        const [habitsRows, achievements] = await Promise.all([
            Store.journalEntries.getFeed(userId, before || null, limit + 1),
            Store.userAchievements.getCompleted(brandVariation, { userId }),
        ]);

        const achievementItems: IJournalFeedItem[] = (achievements || [])
            .filter((achievement: any) => {
                if (!achievement.completedAt) {
                    return false;
                }
                if (!before) {
                    return true;
                }
                return new Date(achievement.completedAt).getTime() < Date.parse(before);
            })
            .map((achievement: any) => ({
                id: achievement.id,
                type: 'achievement',
                occurredAt: toIsoDate(achievement.completedAt),
                entryDate: toEntryDate(achievement.completedAt),
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
            .slice(0, limit + 1);

        const merged = [...habitsRows.map(normalizeRow), ...achievementItems]
            // Ties are broken by id so the order is total. Without that, two
            // items sharing a timestamp can swap places between pages and one
            // of them is never returned.
            .sort((a, b) => {
                const delta = Date.parse(b.occurredAt) - Date.parse(a.occurredAt);
                if (delta !== 0) {
                    return delta;
                }
                return b.id.localeCompare(a.id);
            });

        const items = merged.slice(0, limit);
        const hasMore = merged.length > limit;

        return res.status(200).send({
            items,
            // The cursor is the last returned item's timestamp, and `before` is
            // exclusive, so the next page cannot repeat it.
            nextCursor: hasMore && items.length ? items[items.length - 1].occurredAt : null,
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
