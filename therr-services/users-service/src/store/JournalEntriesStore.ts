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
     * `before` is exclusive, so paging cannot repeat the boundary row. Ties on
     * `occurredAt` are broken by id to keep the order total — without that, two
     * items sharing a timestamp can swap between pages and one is lost.
     */
    getFeed(userId: string, before: string | null, limit: number): Promise<IJournalFeedRow[]> {
        const beforePredicate = before ? 'AND source."occurredAt" < ?::timestamptz' : '';
        const bindings: any[] = [userId, userId, userId, userId];

        if (before) {
            bindings.push(before);
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
            ORDER BY source."occurredAt" DESC, source."id" DESC
            LIMIT ?`,
            bindings,
        ).toString();

        return this.db.read.query(queryString)
            .then((response) => response.rows as IJournalFeedRow[]);
    }
}
