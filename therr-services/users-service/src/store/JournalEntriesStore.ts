import KnexBuilder, { Knex } from 'knex';
import { IConnection } from './connection';
import {
    HABIT_CHECKINS_TABLE_NAME,
    HABIT_GOALS_TABLE_NAME,
    JOURNAL_ENTRIES_TABLE_NAME,
    STREAKS_TABLE_NAME,
    STREAK_HISTORY_TABLE_NAME,
    USER_HABITS_TABLE_NAME,
} from './tableNames';

const knexBuilder: Knex = KnexBuilder({ client: 'pg' });

export type JournalFeedItemType = 'note' | 'checkin' | 'milestone' | 'habit_started';

/**
 * Where the previous page of the feed stopped.
 *
 * The pair is the cursor, not the timestamp — see `getFeed` for why a
 * timestamp-only cursor drops entries. `id` is nullable so a bare-ISO cursor
 * minted by an earlier build still pages.
 */
export interface IJournalFeedCursor {
    occurredAt: string;
    id: string | null;
}

export interface IJournalEntryRow {
    id: string;
    userId: string;
    habitGoalId: string | null;
    checkinId: string | null;
    body: string;
    entryDate: string;
    occurredAt: Date;
    createdAt: Date;
    updatedAt: Date;
}

export interface ICreateJournalEntryParams {
    userId: string;
    habitGoalId?: string | null;
    checkinId?: string | null;
    body: string;
    entryDate: string;
    occurredAt?: string | null;
}

/**
 * One row of the merged journal feed.
 *
 * The shape is deliberately uniform across sources so the client renders a
 * single list and does no per-type fetching. `meta` carries the handful of
 * per-type extras (check-in status, milestone day count) rather than widening
 * the row with columns that are null for four types out of five.
 */
export interface IJournalFeedRow {
    id: string;
    type: JournalFeedItemType;
    occurredAt: Date;
    entryDate: string;
    body: string | null;
    habitGoalId: string | null;
    goalName: string | null;
    goalEmoji: string | null;
    meta: any;
}

export default class JournalEntriesStore {
    db: IConnection;

    constructor(dbConnection: IConnection) {
        this.db = dbConnection;
    }

    getById(id: string, userId: string): Promise<IJournalEntryRow | undefined> {
        const queryString = knexBuilder
            .from(JOURNAL_ENTRIES_TABLE_NAME)
            .where({ id, userId })
            .limit(1)
            .toString();

        return this.db.read.query(queryString)
            .then((response) => response.rows[0] as IJournalEntryRow | undefined);
    }

    create(params: ICreateJournalEntryParams): Promise<IJournalEntryRow> {
        const queryString = knexBuilder
            .insert({
                userId: params.userId,
                habitGoalId: params.habitGoalId ?? null,
                checkinId: params.checkinId ?? null,
                body: params.body,
                entryDate: params.entryDate,
                ...(params.occurredAt ? { occurredAt: params.occurredAt } : {}),
            })
            .into(JOURNAL_ENTRIES_TABLE_NAME)
            .returning('*')
            .toString();

        return this.db.write.query(queryString)
            .then((response) => response.rows[0] as IJournalEntryRow);
    }

    update(id: string, userId: string, params: { body?: string; habitGoalId?: string | null }) {
        const queryString = knexBuilder
            .from(JOURNAL_ENTRIES_TABLE_NAME)
            .where({ id, userId })
            .update({ ...params, updatedAt: new Date() })
            .returning('*')
            .toString();

        return this.db.write.query(queryString)
            .then((response) => response.rows[0] as IJournalEntryRow | undefined);
    }

    delete(id: string, userId: string) {
        const queryString = knexBuilder
            .from(JOURNAL_ENTRIES_TABLE_NAME)
            .where({ id, userId })
            .delete()
            .returning('id')
            .toString();

        return this.db.write.query(queryString).then((response) => response.rows);
    }

    /**
     * The journal feed: notes, check-ins, streak milestones and habit starts,
     * interleaved newest-first.
     *
     * WHY ONE UNION QUERY RATHER THAN FOUR QUERIES MERGED IN JS
     *
     * The feed is paginated by a cursor on `occurredAt`. Merging in the handler
     * would mean over-fetching `limit` rows from every source and discarding
     * most of them, and the discarded rows are not free — they are the ones
     * nearest the cursor, so a day with many check-ins can push notes out of
     * the window entirely and they never reappear on the next page. Letting
     * Postgres do the ORDER BY / LIMIT over the union is both correct and one
     * round trip.
     *
     * Achievements are NOT in this union. `main.userAchievements` is a
     * brand-scoped table, so it must be read through `UserAchievementsStore`
     * with an explicit `brandVariation` — referencing it directly here would
     * both trip `therr/no-direct-brand-scoped-table` and, worse, leak a user's
     * Therr achievements into their Habits journal. The handler fetches that
     * one source separately and merges it; see `handlers/journal.ts`.
     *
     * PAGINATION IS KEYED ON (occurredAt, id), NOT ON occurredAt ALONE
     *
     * A cursor that only carries a timestamp cannot page a feed whose timestamps
     * are not unique. `occurredAt` collides readily: `now()` is the transaction
     * timestamp, so anything written by one statement shares it, and a client may
     * supply its own second-precision `occurredAt` on a note. With a
     * timestamp-only cursor and a strict `<`, every item sharing the last
     * returned item's instant is skipped on the next page and never appears
     * again — silently losing entries the user wrote, which is the one failure a
     * journal must not have. Ordering alone does not fix this: making the sort
     * total stops two items *swapping* places, but the cursor still steps past
     * both of them.
     *
     * So the cursor is the pair, the comparison is lexicographic over it, and the
     * ORDER BY matches it exactly. `before` remains exclusive, so paging cannot
     * repeat the boundary row either.
     *
     * `id` is compared as text under `COLLATE "C"` — byte ordering — rather than
     * the database's default collation. The handler re-sorts the SQL rows
     * together with the separately-fetched achievements, and it compares ids with
     * JavaScript's code-point `<`. A locale collation can treat punctuation as
     * variable-weight, which would order `-` differently from code-point order
     * and let the two halves disagree about what "after the cursor" means.
     * `COLLATE "C"` and code-point ordering agree for ASCII, which uuid text and
     * integer text both are.
     *
     * A cursor with no `id` is accepted and treated as timestamp-exclusive, so a
     * client still holding a bare-ISO cursor from an earlier build keeps paging
     * rather than erroring.
     */
    getFeed(userId: string, before: IJournalFeedCursor | null, limit: number): Promise<IJournalFeedRow[]> {
        const bindings: any[] = [userId, userId, userId, userId];
        let beforePredicate = '';

        if (before?.id) {
            beforePredicate = `AND (source."occurredAt" < ?::timestamptz
                    OR (source."occurredAt" = ?::timestamptz
                        AND source."id"::text COLLATE "C" < ?))`;
            bindings.push(before.occurredAt, before.occurredAt, before.id);
        } else if (before) {
            beforePredicate = 'AND source."occurredAt" < ?::timestamptz';
            bindings.push(before.occurredAt);
        }

        bindings.push(limit);

        const queryString = knexBuilder.raw(
            `WITH source AS (
                SELECT
                    j."id",
                    'note' AS "type",
                    j."occurredAt",
                    j."entryDate",
                    j."body",
                    j."habitGoalId",
                    NULL::jsonb AS "meta"
                FROM ${JOURNAL_ENTRIES_TABLE_NAME} j
                WHERE j."userId" = ?::uuid

                UNION ALL

                -- Check-ins that were actually acted on. 'pending' rows are
                -- scaffolding the app writes ahead of the user doing anything,
                -- so including them would fill the journal with entries for
                -- things that never happened.
                SELECT
                    c."id",
                    'checkin' AS "type",
                    COALESCE(c."completedAt", c."createdAt") AS "occurredAt",
                    c."scheduledDate"::date AS "entryDate",
                    c."notes" AS "body",
                    c."habitGoalId",
                    jsonb_build_object(
                        'status', c."status",
                        'selfRating', c."selfRating",
                        'hasProof', c."hasProof"
                    ) AS "meta"
                FROM ${HABIT_CHECKINS_TABLE_NAME} c
                WHERE c."userId" = ?::uuid
                    AND c."status" IN ('completed', 'partial', 'skipped')

                UNION ALL

                SELECT
                    h."id",
                    'milestone' AS "type",
                    h."createdAt" AS "occurredAt",
                    h."eventDate"::date AS "entryDate",
                    NULL AS "body",
                    s."habitGoalId",
                    jsonb_build_object(
                        'milestoneReached', h."milestoneReached",
                        'streakAfter', h."streakAfter"
                    ) AS "meta"
                FROM ${STREAK_HISTORY_TABLE_NAME} h
                INNER JOIN ${STREAKS_TABLE_NAME} s ON s."id" = h."streakId"
                WHERE h."userId" = ?::uuid
                    AND h."eventType" = 'milestone_reached'

                UNION ALL

                SELECT
                    uh."id",
                    'habit_started' AS "type",
                    uh."startedAt" AS "occurredAt",
                    uh."startedAt"::date AS "entryDate",
                    NULL AS "body",
                    uh."habitGoalId",
                    NULL::jsonb AS "meta"
                FROM ${USER_HABITS_TABLE_NAME} uh
                WHERE uh."userId" = ?::uuid
            )
            SELECT
                source.*,
                g."name" AS "goalName",
                g."emoji" AS "goalEmoji"
            FROM source
            LEFT JOIN ${HABIT_GOALS_TABLE_NAME} g ON g."id" = source."habitGoalId"
            WHERE true ${beforePredicate}
            ORDER BY source."occurredAt" DESC, source."id"::text COLLATE "C" DESC
            LIMIT ?`,
            bindings,
        ).toString();

        return this.db.read.query(queryString)
            .then((response) => response.rows as IJournalFeedRow[]);
    }
}
