import KnexBuilder, { Knex } from 'knex';
import { IConnection } from './connection';
import {
    HABIT_GOALS_TABLE_NAME,
    PACT_JOIN_REQUESTS_TABLE_NAME,
    PACTS_TABLE_NAME,
    USERS_TABLE_NAME,
} from './tableNames';

const knexBuilder: Knex = KnexBuilder({ client: 'pg' });

export type PactJoinRequestStatus = 'pending' | 'approved' | 'declined' | 'cancelled';

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

    /** The creator's queue: pending requests on one pact, oldest first, with who is asking. */
    getPendingByPact(pactId: string): Promise<IPactJoinRequestRow[]> {
        const queryString = knexBuilder
            .select([
                `${PACT_JOIN_REQUESTS_TABLE_NAME}.*`,
                `${USERS_TABLE_NAME}.userName as requesterUserName`,
            ])
            .from(PACT_JOIN_REQUESTS_TABLE_NAME)
            .innerJoin(USERS_TABLE_NAME, `${USERS_TABLE_NAME}.id`, `${PACT_JOIN_REQUESTS_TABLE_NAME}.requesterUserId`)
            .where(`${PACT_JOIN_REQUESTS_TABLE_NAME}.pactId`, pactId)
            .andWhere(`${PACT_JOIN_REQUESTS_TABLE_NAME}.status`, 'pending')
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
