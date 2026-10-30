import KnexBuilder, { Knex } from 'knex';
import { IConnection } from './connection';
import {
    HABIT_CHECKINS_TABLE_NAME,
    HABIT_GOALS_TABLE_NAME,
    PACTS_TABLE_NAME,
    PACT_CHAT_REACTIONS_TABLE_NAME,
    PACT_MEMBERS_TABLE_NAME,
    PACT_MESSAGES_TABLE_NAME,
} from './tableNames';

const knexBuilder: Knex = KnexBuilder({ client: 'pg' });

/**
 * How far back a renewal chain is followed when assembling one pact's thread. A renewal is a
 * new pact row pointing at its predecessor (`renewedFromPactId`); twelve 30-day cycles is a
 * year of the same people, far past anything in production, and bounds the recursive read.
 */
export const MAX_THREAD_CYCLES = 12;

export type PactChatTargetKind = 'message' | 'checkin';

export interface IPactMessageRow {
    id: string;
    pactId: string;
    userId: string;
    text: string;
    clientMessageId?: string | null;
    reportedAt?: Date | null;
    reportedByUserIds?: string[];
    createdAt: Date | string;
}

export interface IPactChatCheckinRow {
    id: string;
    pactId: string;
    userId: string;
    habitGoalId: string;
    habitGoalName?: string | null;
    habitGoalEmoji?: string | null;
    notes?: string | null;
    hasProof?: boolean;
    /** completedAt, or createdAt for a row that never stamped one — the timeline position. */
    occurredAt: Date | string;
}

export interface IPactChatReactionRow {
    targetId: string;
    targetKind: PactChatTargetKind;
    userId: string;
    emoji: string;
}

export interface ITimelineWindow {
    /** Exclusive upper bound — scrolling back. */
    before?: Date;
    /** Exclusive lower bound — polling for what is new. */
    after?: Date;
    limit: number;
}

export interface ICreatePactMessageParams {
    pactId: string;
    userId: string;
    text: string;
    clientMessageId?: string;
}

const applyWindow = (query: Knex.QueryBuilder, column: string, window: ITimelineWindow) => {
    let next = query;
    if (window.before) {
        next = next.andWhere(column, '<', window.before.toISOString());
    }
    if (window.after) {
        // The cursor is an item's ISO createdAt (ms) while the column holds µs, so the cursor item
        // itself sorts after its own truncated time and comes back on every poll; the client
        // de-dupes by id. Deliberate: comparing at ms instead would also drop a different item
        // written in the same millisecond, and a duplicate is recoverable where a gap is not.
        next = next.andWhere(column, '>', window.after.toISOString());
    }
    // Polling reads forwards (oldest new item first, so a burst larger than `limit` is not
    // skipped); scrolling back reads backwards. The handler sorts the merged page for display.
    return next.orderBy(column, window.after ? 'asc' : 'desc').limit(window.limit);
};

/**
 * Pact chat. See docs/niche-sub-apps/habits/HABITS_PACT_CHAT_DESIGN.md.
 *
 * The timeline is two sources read side by side — written messages, and the thread's completed
 * check-ins — rather than one table, so the check-in path writes nothing for chat.
 */
export default class PactChatStore {
    db: IConnection;

    constructor(dbConnection: IConnection) {
        this.db = dbConnection;
    }

    /**
     * The pact ids that make up `pactId`'s thread: itself and the cycles it renewed from,
     * nearest first. Walks predecessors only — an old cycle's thread does not include the
     * conversation that happened after it was renewed.
     */
    getThreadPactIds(pactId: string): Promise<string[]> {
        const queryString = knexBuilder.raw(`
            WITH RECURSIVE chain AS (
                SELECT "id", "renewedFromPactId", 1 AS depth
                FROM ${PACTS_TABLE_NAME} WHERE "id" = ?
                UNION ALL
                SELECT p."id", p."renewedFromPactId", chain.depth + 1
                FROM ${PACTS_TABLE_NAME} p
                JOIN chain ON p."id" = chain."renewedFromPactId"
                WHERE chain.depth < ?
            )
            SELECT "id" FROM chain ORDER BY depth ASC
        `, [pactId, MAX_THREAD_CYCLES]).toString();

        return this.db.read.query(queryString)
            .then((response) => response.rows.map((row: any) => row.id));
    }

    getMessages(
        pactIds: string[],
        window: ITimelineWindow,
        { viewerUserId, excludeAuthorIds = [] }: { viewerUserId: string; excludeAuthorIds?: string[] },
    ): Promise<IPactMessageRow[]> {
        if (!pactIds.length) {
            return Promise.resolve([]);
        }

        let query = knexBuilder
            .from(PACT_MESSAGES_TABLE_NAME)
            .whereIn('pactId', pactIds)
            // A message the viewer reported is gone for them; others still see it until moderated.
            .andWhereRaw('NOT ("reportedByUserIds" @> ?::jsonb)', [JSON.stringify([viewerUserId])]);

        if (excludeAuthorIds.length) {
            query = query.whereNotIn('userId', excludeAuthorIds);
        }

        return this.db.read.query(applyWindow(query, 'createdAt', window).toString())
            .then((response) => response.rows);
    }

    getCompletedCheckins(pactIds: string[], window: ITimelineWindow): Promise<IPactChatCheckinRow[]> {
        if (!pactIds.length) {
            return Promise.resolve([]);
        }

        const occurredAt = `COALESCE(${HABIT_CHECKINS_TABLE_NAME}."completedAt", ${HABIT_CHECKINS_TABLE_NAME}."createdAt")`;
        // Wrapped in a subquery so the window can filter and order on the computed position.
        const inner = knexBuilder
            .select([
                `${HABIT_CHECKINS_TABLE_NAME}.id`,
                `${HABIT_CHECKINS_TABLE_NAME}.pactId`,
                `${HABIT_CHECKINS_TABLE_NAME}.userId`,
                `${HABIT_CHECKINS_TABLE_NAME}.habitGoalId`,
                `${HABIT_CHECKINS_TABLE_NAME}.notes`,
                `${HABIT_CHECKINS_TABLE_NAME}.hasProof`,
                `${HABIT_GOALS_TABLE_NAME}.name as habitGoalName`,
                `${HABIT_GOALS_TABLE_NAME}.emoji as habitGoalEmoji`,
                knexBuilder.raw(`${occurredAt} as "occurredAt"`),
            ])
            .from(HABIT_CHECKINS_TABLE_NAME)
            .leftJoin(HABIT_GOALS_TABLE_NAME, `${HABIT_CHECKINS_TABLE_NAME}.habitGoalId`, `${HABIT_GOALS_TABLE_NAME}.id`)
            .whereIn(`${HABIT_CHECKINS_TABLE_NAME}.pactId`, pactIds)
            .andWhere(`${HABIT_CHECKINS_TABLE_NAME}.status`, 'completed')
            .as('checkins');

        const query = knexBuilder.select('*').from(inner).where(knexBuilder.raw('true'));

        return this.db.read.query(applyWindow(query, 'occurredAt', window).toString())
            .then((response) => response.rows);
    }

    getReactions(targetIds: string[]): Promise<IPactChatReactionRow[]> {
        if (!targetIds.length) {
            return Promise.resolve([]);
        }

        const queryString = knexBuilder
            .select(['targetId', 'targetKind', 'userId', 'emoji'])
            .from(PACT_CHAT_REACTIONS_TABLE_NAME)
            .whereIn('targetId', targetIds)
            .orderBy('createdAt', 'asc')
            .toString();

        return this.db.read.query(queryString).then((response) => response.rows);
    }

    /**
     * Idempotent on `(userId, clientMessageId)`: a retried send returns the row the first
     * attempt wrote instead of posting the message twice.
     */
    async createMessage(params: ICreatePactMessageParams): Promise<{ message: IPactMessageRow; isNew: boolean }> {
        const insert = knexBuilder
            .insert({
                pactId: params.pactId,
                userId: params.userId,
                text: params.text,
                ...(params.clientMessageId ? { clientMessageId: params.clientMessageId } : {}),
            })
            .into(PACT_MESSAGES_TABLE_NAME)
            .onConflict(['userId', 'clientMessageId'])
            .ignore()
            .returning('*')
            .toString();

        const inserted = await this.db.write.query(insert);
        if (inserted.rows[0]) {
            return { message: inserted.rows[0], isNew: true };
        }

        const existing = await this.db.write.query(knexBuilder
            .from(PACT_MESSAGES_TABLE_NAME)
            .where({ userId: params.userId, clientMessageId: params.clientMessageId })
            .limit(1)
            .toString());
        return { message: existing.rows[0], isNew: false };
    }

    getMessageById(id: string): Promise<IPactMessageRow | undefined> {
        return this.db.read.query(knexBuilder.from(PACT_MESSAGES_TABLE_NAME).where({ id }).limit(1).toString())
            .then((response) => response.rows[0]);
    }

    reportMessage(id: string, reporterUserId: string): Promise<IPactMessageRow | undefined> {
        const queryString = knexBuilder
            .from(PACT_MESSAGES_TABLE_NAME)
            .where({ id })
            .update({
                reportedAt: knexBuilder.raw('COALESCE("reportedAt", now())'),
                reportedByUserIds: knexBuilder.raw(
                    'CASE WHEN "reportedByUserIds" @> ?::jsonb THEN "reportedByUserIds" ELSE "reportedByUserIds" || ?::jsonb END',
                    [JSON.stringify([reporterUserId]), JSON.stringify([reporterUserId])],
                ),
            })
            .returning('*')
            .toString();

        return this.db.write.query(queryString).then((response) => response.rows[0]);
    }

    /** Sets, or replaces, the caller's one reaction on a timeline item. */
    setReaction(params: {
        pactId: string; userId: string; targetKind: PactChatTargetKind; targetId: string; emoji: string;
    }): Promise<IPactChatReactionRow> {
        const queryString = knexBuilder
            .insert({ ...params })
            .into(PACT_CHAT_REACTIONS_TABLE_NAME)
            .onConflict(['targetId', 'userId'])
            .merge({ emoji: params.emoji, updatedAt: new Date() })
            .returning(['targetId', 'targetKind', 'userId', 'emoji'])
            .toString();

        return this.db.write.query(queryString).then((response) => response.rows[0]);
    }

    clearReaction(targetId: string, userId: string): Promise<number> {
        const queryString = knexBuilder
            .from(PACT_CHAT_REACTIONS_TABLE_NAME)
            .where({ targetId, userId })
            .delete()
            .toString();

        return this.db.write.query(queryString).then((response) => response.rowCount || 0);
    }

    /** Moves the caller's unread watermark forward. Never backwards: a stale device cannot un-read. */
    markRead(pactId: string, userId: string, readAt: Date = new Date()): Promise<number> {
        const queryString = knexBuilder
            .from(PACT_MEMBERS_TABLE_NAME)
            .where({ pactId, userId })
            .update({
                chatLastReadAt: knexBuilder.raw('GREATEST(COALESCE("chatLastReadAt", \'-infinity\'::timestamptz), ?::timestamptz)', [readAt.toISOString()]),
            })
            .toString();

        return this.db.write.query(queryString).then((response) => response.rowCount || 0);
    }

    /**
     * Unread messages per pact for one viewer: messages by someone else, newer than the viewer's
     * watermark on that pact, minus what they blocked or reported. One grouped query for a page
     * of pacts. Only each pact's own messages are counted — new messages are always written to
     * the current cycle, so a thread's ancestors have nothing unread.
     */
    countUnreadByPact(pactIds: string[], viewerUserId: string, excludeAuthorIds: string[] = []): Promise<Record<string, number>> {
        if (!pactIds.length) {
            return Promise.resolve({});
        }

        let query = knexBuilder
            .select(`${PACT_MESSAGES_TABLE_NAME}.pactId`)
            .count(`${PACT_MESSAGES_TABLE_NAME}.id as count`)
            .from(PACT_MESSAGES_TABLE_NAME)
            .join(PACT_MEMBERS_TABLE_NAME, function joinViewer() {
                this.on(`${PACT_MEMBERS_TABLE_NAME}.pactId`, '=', `${PACT_MESSAGES_TABLE_NAME}.pactId`)
                    .andOn(`${PACT_MEMBERS_TABLE_NAME}.userId`, '=', knexBuilder.raw('?', [viewerUserId]));
            })
            .whereIn(`${PACT_MESSAGES_TABLE_NAME}.pactId`, pactIds)
            .andWhere(`${PACT_MESSAGES_TABLE_NAME}.userId`, '<>', viewerUserId)
            .andWhereRaw(`(${PACT_MEMBERS_TABLE_NAME}."chatLastReadAt" IS NULL
                OR ${PACT_MESSAGES_TABLE_NAME}."createdAt" > ${PACT_MEMBERS_TABLE_NAME}."chatLastReadAt")`)
            .andWhereRaw(`NOT (${PACT_MESSAGES_TABLE_NAME}."reportedByUserIds" @> ?::jsonb)`, [JSON.stringify([viewerUserId])])
            .groupBy(`${PACT_MESSAGES_TABLE_NAME}.pactId`);

        if (excludeAuthorIds.length) {
            query = query.whereNotIn(`${PACT_MESSAGES_TABLE_NAME}.userId`, excludeAuthorIds);
        }

        return this.db.read.query(query.toString()).then((response) => response.rows.reduce((acc: Record<string, number>, row: any) => {
            acc[row.pactId] = parseInt(row.count, 10) || 0;
            return acc;
        }, {}));
    }
}
