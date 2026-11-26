import KnexBuilder, { Knex } from 'knex';
import { quoteTableName } from 'therr-js-utilities/db';
import { IConnection } from './connection';
import {
    HABIT_CHECKINS_TABLE_NAME,
    HABIT_GOALS_TABLE_NAME,
    PACT_JOIN_REQUESTS_TABLE_NAME,
    PACT_MESSAGES_TABLE_NAME,
    PACTS_TABLE_NAME,
    USERS_TABLE_NAME,
} from './tableNames';

const knexBuilder: Knex = KnexBuilder({ client: 'pg' });

/**
 * `expired`: nobody answered in time, or the pact stopped being able to take anyone. Written only by
 * the digest (`expireStale`), so a request stops counting against the requester's
 * MAX_PENDING_JOIN_REQUESTS_PER_USER once it can no longer be answered.
 */
export type PactJoinRequestStatus = 'pending' | 'approved' | 'declined' | 'cancelled' | 'expired';

/**
 * An open pact whose creator has gone quiet while someone waits to join it. See
 * `getPactsAwaitingHandoff` and helpers/openPactHandoff.ts.
 */
export interface IPactAwaitingHandoffRow {
    pactId: string;
    creatorUserId: string;
    habitGoalName: string | null;
    /** The creator's most recent sign of life: login, check-in, or a message in this pact's chat. */
    creatorLastActiveAt: Date | null;
    creatorIsSoftDeleted: boolean;
}

// A creator's latest sign of life. `lastLoginAt` alone is not enough: the app stays signed in
// through refresh tokens, which write nothing, so a daily user's last *login* can be months old.
// A check-in (on any habit) or a message in this pact's chat is the activity that matters here.
// Falls back to the account's creation, so a user with no activity at all is measured from signup.
// `userAlias` names a row of main.users in the enclosing query; `pactIdSql` is the pact whose chat
// counts. The same measure decides who has gone quiet and who may take a pact over, so a host is
// never held to a looser standard than the creator they replace.
const userLastActiveSql = (userAlias: string, pactIdSql: string) => {
    const user = quoteTableName(userAlias);
    return 'GREATEST('
        + `${user}."createdAt", `
        + `COALESCE(${user}."lastLoginAt", ${user}."createdAt"), `
        + `COALESCE((SELECT MAX(hc."createdAt") FROM ${HABIT_CHECKINS_TABLE_NAME} AS hc WHERE hc."userId" = ${user}."id"), ${user}."createdAt"), `
        + `COALESCE((SELECT MAX(pm."createdAt") FROM ${PACT_MESSAGES_TABLE_NAME} AS pm`
        + ` WHERE pm."pactId" = ${pactIdSql} AND pm."userId" = ${user}."id"), ${user}."createdAt")`
        + ')';
};

const creatorLastActiveSql = () => userLastActiveSql('creator', `${PACTS_TABLE_NAME}."id"`);

export interface IPactJoinRequestRow {
    id: string;
    pactId: string;
    requesterUserId: string;
    status: PactJoinRequestStatus;
    respondedAt: Date | null;
    /** When the creator was emailed about this request (helpers/joinRequestEmailDigest.ts). */
    emailReminderSentAt?: Date | null;
    createdAt: Date;
    updatedAt: Date;
    /** Present on reads that join the requester — what the creator sees when deciding. */
    requesterUserName?: string;
}

/**
 * A pending request the digest may email the pact's creator about: the request, the pact's habit,
 * who is asking, and what the creator's email preferences are. See `getUnansweredForEmailReminder`.
 */
export interface IUnansweredJoinRequestRow {
    requestId: string;
    pactId: string;
    requesterUserName: string | null;
    habitGoalName: string | null;
    creatorUserId: string;
    creatorUserName: string | null;
    creatorFirstName: string | null;
    creatorEmail: string | null;
    creatorIsUnclaimed: boolean | null;
    creatorSettingsEmailReminders: boolean | null;
    creatorSettingsLocale: string | null;
    createdAt: Date;
}

/**
 * Requests from users outside an open pact to join it. See migration
 * 20261005000003_habits.pact_join_requests.js for why these are not pact_members rows.
 */
export default class PactJoinRequestsStore {
    db: IConnection;

    constructor(dbConnection: IConnection) {
        this.db = dbConnection;
    }

    getById(id: string): Promise<IPactJoinRequestRow | undefined> {
        const queryString = knexBuilder
            .from(PACT_JOIN_REQUESTS_TABLE_NAME)
            .where({ id })
            .toString();

        return this.db.read.query(queryString).then((response) => response.rows[0]);
    }

    getPendingByPactAndRequester(pactId: string, requesterUserId: string): Promise<IPactJoinRequestRow | undefined> {
        const queryString = knexBuilder
            .from(PACT_JOIN_REQUESTS_TABLE_NAME)
            .where({ pactId, requesterUserId, status: 'pending' })
            .toString();

        return this.db.read.query(queryString).then((response) => response.rows[0]);
    }

    /**
     * The creator's queue: pending requests on one pact, oldest first, with who is asking.
     * `excludeSoftDeletedRequesters` drops requesters who have since deleted their account — the
     * digest's handoff (helpers/openPactHandoff.ts) must not hand a pact to a dead account.
     */
    getPendingByPact(pactId: string, { excludeSoftDeletedRequesters = false } = {}): Promise<IPactJoinRequestRow[]> {
        let query = knexBuilder
            .select([
                `${PACT_JOIN_REQUESTS_TABLE_NAME}.*`,
                `${USERS_TABLE_NAME}.userName as requesterUserName`,
            ])
            .from(PACT_JOIN_REQUESTS_TABLE_NAME)
            .innerJoin(USERS_TABLE_NAME, `${USERS_TABLE_NAME}.id`, `${PACT_JOIN_REQUESTS_TABLE_NAME}.requesterUserId`)
            .where(`${PACT_JOIN_REQUESTS_TABLE_NAME}.pactId`, pactId)
            .andWhere(`${PACT_JOIN_REQUESTS_TABLE_NAME}.status`, 'pending');
        if (excludeSoftDeletedRequesters) {
            query = query.andWhere((builder) => {
                builder.where(`${USERS_TABLE_NAME}.settingsIsAccountSoftDeleted`, false)
                    .orWhereNull(`${USERS_TABLE_NAME}.settingsIsAccountSoftDeleted`);
            });
        }
        const queryString = query
            .orderBy(`${PACT_JOIN_REQUESTS_TABLE_NAME}.createdAt`, 'asc')
            .toString();

        return this.db.read.query(queryString).then((response) => response.rows);
    }

    countPendingByRequester(requesterUserId: string): Promise<number> {
        const queryString = knexBuilder
            .from(PACT_JOIN_REQUESTS_TABLE_NAME)
            .where({ requesterUserId, status: 'pending' })
            .count('id as count')
            .toString();

        return this.db.read.query(queryString)
            .then((response) => parseInt(response.rows[0]?.count ?? '0', 10));
    }

    /**
     * Inserts a pending request, or returns undefined when one is already pending for this
     * (pact, requester) — the partial unique index decides, so two concurrent taps cannot both
     * insert. The caller reads the existing row back in that case.
     */
    createPending(pactId: string, requesterUserId: string): Promise<IPactJoinRequestRow | undefined> {
        const queryString = knexBuilder.raw(
            `INSERT INTO ${PACT_JOIN_REQUESTS_TABLE_NAME} ("pactId", "requesterUserId", "status")`
            + ' VALUES (?, ?, \'pending\')'
            + ' ON CONFLICT ("pactId", "requesterUserId") WHERE "status" = \'pending\' DO NOTHING'
            + ' RETURNING *',
            [pactId, requesterUserId],
        ).toString();

        return this.db.write.query(queryString).then((response) => response.rows[0]);
    }

    /**
     * Moves a pending request to its answer. Conditional on it still being pending, so a double
     * tap — or approve racing cancel — resolves exactly once; the loser gets undefined back.
     */
    resolvePending(id: string, status: Exclude<PactJoinRequestStatus, 'pending'>): Promise<IPactJoinRequestRow | undefined> {
        const now = new Date();
        const queryString = knexBuilder
            .where({ id, status: 'pending' })
            .update({
                status,
                respondedAt: status === 'cancelled' ? null : now,
                updatedAt: now,
            })
            .into(PACT_JOIN_REQUESTS_TABLE_NAME)
            .returning('*')
            .toString();

        return this.db.write.query(queryString).then((response) => response.rows[0]);
    }

    /**
     * Pending requests created in [createdAfter, createdBefore] whose creator has not been emailed
     * about them, on pacts that can still take the requester (running, per JOINABLE_PACT_STATUSES
     * and the end date — the same test approval applies). Oldest first. A closed pact still counts:
     * closing stops new requests, and the ones already waiting can still be answered.
     */
    getUnansweredForEmailReminder(
        createdBefore: Date,
        createdAfter: Date,
        joinableStatuses: string[],
        limit: number,
        now: Date = new Date(),
    ): Promise<IUnansweredJoinRequestRow[]> {
        const queryString = knexBuilder
            .select([
                `${PACT_JOIN_REQUESTS_TABLE_NAME}.id as requestId`,
                `${PACT_JOIN_REQUESTS_TABLE_NAME}.pactId`,
                `${PACT_JOIN_REQUESTS_TABLE_NAME}.createdAt`,
                'requester.userName as requesterUserName',
                `${HABIT_GOALS_TABLE_NAME}.name as habitGoalName`,
                `${PACTS_TABLE_NAME}.creatorUserId`,
                'creator.userName as creatorUserName',
                'creator.firstName as creatorFirstName',
                'creator.email as creatorEmail',
                'creator.isUnclaimed as creatorIsUnclaimed',
                'creator.settingsEmailReminders as creatorSettingsEmailReminders',
                'creator.settingsLocale as creatorSettingsLocale',
            ])
            .from(PACT_JOIN_REQUESTS_TABLE_NAME)
            .innerJoin(PACTS_TABLE_NAME, `${PACTS_TABLE_NAME}.id`, `${PACT_JOIN_REQUESTS_TABLE_NAME}.pactId`)
            .innerJoin(HABIT_GOALS_TABLE_NAME, `${HABIT_GOALS_TABLE_NAME}.id`, `${PACTS_TABLE_NAME}.habitGoalId`)
            .innerJoin(`${USERS_TABLE_NAME} as requester`, 'requester.id', `${PACT_JOIN_REQUESTS_TABLE_NAME}.requesterUserId`)
            .innerJoin(`${USERS_TABLE_NAME} as creator`, 'creator.id', `${PACTS_TABLE_NAME}.creatorUserId`)
            .where(`${PACT_JOIN_REQUESTS_TABLE_NAME}.status`, 'pending')
            .whereNull(`${PACT_JOIN_REQUESTS_TABLE_NAME}.emailReminderSentAt`)
            .andWhere(`${PACT_JOIN_REQUESTS_TABLE_NAME}.createdAt`, '<=', createdBefore)
            .andWhere(`${PACT_JOIN_REQUESTS_TABLE_NAME}.createdAt`, '>=', createdAfter)
            .whereIn(`${PACTS_TABLE_NAME}.status`, joinableStatuses)
            .andWhere((builder) => {
                builder.whereNull(`${PACTS_TABLE_NAME}.endDate`)
                    .orWhere(`${PACTS_TABLE_NAME}.endDate`, '>', now);
            })
            .andWhere((builder) => {
                builder.where('creator.settingsIsAccountSoftDeleted', false)
                    .orWhereNull('creator.settingsIsAccountSoftDeleted');
            })
            .orderBy(`${PACT_JOIN_REQUESTS_TABLE_NAME}.createdAt`, 'asc')
            .limit(Math.max(1, limit))
            .toString();

        return this.db.read.query(queryString).then((response) => response.rows);
    }

    /**
     * Claims the once-per-request email for each id still pending and unclaimed, and returns the ids
     * it claimed. Conditional, so an overlapping digest run gets nothing back for the same requests,
     * and a request answered since it was read is not claimed (or emailed about).
     */
    claimEmailReminders(ids: string[]): Promise<string[]> {
        if (!ids.length) {
            return Promise.resolve([]);
        }
        const queryString = knexBuilder
            .whereIn('id', ids)
            .andWhere('status', 'pending')
            .whereNull('emailReminderSentAt')
            .update({ emailReminderSentAt: new Date() })
            .into(PACT_JOIN_REQUESTS_TABLE_NAME)
            .returning('id')
            .toString();

        return this.db.write.query(queryString).then((response) => response.rows.map((row: any) => row.id));
    }

    /**
     * Open, running pacts with a request pending since at least `requestCreatedBefore` whose creator
     * has deleted their account or shown no sign of life since `creatorInactiveBefore`. Oldest
     * waiting request first, so the longest wait is handled first when a run is capped.
     *
     * A *closed* pact is left out on purpose: its creator chose to stop taking strangers, and
     * handing it to one would overrule that. Its requests run out through `expireStale` instead.
     */
    /**
     * Each user's latest sign of life, measured exactly as a creator's is for the handoff (login,
     * check-in on any habit, or a message in this pact's chat). Used to keep a quiet person from
     * being made a handed-off pact's host. Users not found are absent from the result.
     */
    getLastActiveAtByUser(pactId: string, userIds: string[]): Promise<Record<string, Date>> {
        if (!userIds.length) {
            return Promise.resolve({});
        }
        const queryString = knexBuilder
            .select([
                'u.id',
                knexBuilder.raw(`${userLastActiveSql('u', '?')} as "lastActiveAt"`, [pactId]),
            ])
            .from(`${USERS_TABLE_NAME} as u`)
            .whereIn('u.id', userIds)
            .toString();

        return this.db.read.query(queryString).then((response) => response.rows.reduce((acc: Record<string, Date>, row: any) => {
            acc[row.id] = new Date(row.lastActiveAt);
            return acc;
        }, {}));
    }

    getPactsAwaitingHandoff(
        requestCreatedBefore: Date,
        creatorInactiveBefore: Date,
        joinableStatuses: string[],
        limit: number,
        now: Date = new Date(),
    ): Promise<IPactAwaitingHandoffRow[]> {
        const oldestWaitingSql = `(SELECT MIN(jr."createdAt") FROM ${PACT_JOIN_REQUESTS_TABLE_NAME} AS jr`
            + ` WHERE jr."pactId" = ${PACTS_TABLE_NAME}."id" AND jr."status" = 'pending')`;
        const queryString = knexBuilder
            .select([
                `${PACTS_TABLE_NAME}.id as pactId`,
                `${PACTS_TABLE_NAME}.creatorUserId`,
                `${HABIT_GOALS_TABLE_NAME}.name as habitGoalName`,
                knexBuilder.raw(`${creatorLastActiveSql()} as "creatorLastActiveAt"`),
                knexBuilder.raw('COALESCE(creator."settingsIsAccountSoftDeleted", false) as "creatorIsSoftDeleted"'),
            ])
            .from(PACTS_TABLE_NAME)
            .innerJoin(HABIT_GOALS_TABLE_NAME, `${HABIT_GOALS_TABLE_NAME}.id`, `${PACTS_TABLE_NAME}.habitGoalId`)
            .innerJoin(`${USERS_TABLE_NAME} as creator`, 'creator.id', `${PACTS_TABLE_NAME}.creatorUserId`)
            .where(`${PACTS_TABLE_NAME}.isOpen`, true)
            .whereIn(`${PACTS_TABLE_NAME}.status`, joinableStatuses)
            .andWhere((builder) => {
                builder.whereNull(`${PACTS_TABLE_NAME}.endDate`)
                    .orWhere(`${PACTS_TABLE_NAME}.endDate`, '>', now);
            })
            .andWhereRaw(`${oldestWaitingSql} <= ?`, [requestCreatedBefore])
            .andWhere((builder) => {
                builder.where('creator.settingsIsAccountSoftDeleted', true)
                    .orWhereRaw(`${creatorLastActiveSql()} <= ?`, [creatorInactiveBefore]);
            })
            .orderByRaw(`${oldestWaitingSql} ASC`)
            .limit(Math.max(1, limit))
            .toString();

        return this.db.read.query(queryString).then((response) => response.rows.map((row: any) => ({
            ...row,
            creatorIsSoftDeleted: !!row.creatorIsSoftDeleted,
        })));
    }

    /**
     * Expires every pending request that can no longer be answered usefully: older than
     * `createdBefore`, or on a pact that has stopped running (ended, completed, or past its end
     * date — approval would refuse it anyway). Returns the ids it expired. Conditional on `pending`,
     * so a request answered meanwhile is untouched.
     */
    expireStale(createdBefore: Date, joinableStatuses: string[], now: Date = new Date()): Promise<string[]> {
        const notRunningPactIds = knexBuilder
            .select('id')
            .from(PACTS_TABLE_NAME)
            .whereNotIn('status', joinableStatuses)
            .orWhere('endDate', '<=', now);
        const queryString = knexBuilder
            .where('status', 'pending')
            .andWhere((builder) => {
                builder.where('createdAt', '<=', createdBefore)
                    .orWhereIn('pactId', notRunningPactIds);
            })
            .update({ status: 'expired', updatedAt: now })
            .into(PACT_JOIN_REQUESTS_TABLE_NAME)
            .returning('id')
            .toString();

        return this.db.write.query(queryString).then((response) => response.rows.map((row: any) => row.id));
    }

    /**
     * Puts an approval back to pending when joining failed after the request was claimed, so the
     * creator can try again rather than leaving a request that says "approved" for someone who
     * never became a member.
     */
    revertApproval(id: string): Promise<IPactJoinRequestRow | undefined> {
        const queryString = knexBuilder
            .where({ id, status: 'approved' })
            .update({ status: 'pending', respondedAt: null, updatedAt: new Date() })
            .into(PACT_JOIN_REQUESTS_TABLE_NAME)
            .returning('*')
            .toString();

        return this.db.write.query(queryString).then((response) => response.rows[0]);
    }
}
