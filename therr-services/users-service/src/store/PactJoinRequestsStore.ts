import KnexBuilder, { Knex } from 'knex';
import { IConnection } from './connection';
import { PACT_JOIN_REQUESTS_TABLE_NAME, USERS_TABLE_NAME } from './tableNames';

const knexBuilder: Knex = KnexBuilder({ client: 'pg' });

export type PactJoinRequestStatus = 'pending' | 'approved' | 'declined' | 'cancelled';

export interface IPactJoinRequestRow {
    id: string;
    pactId: string;
    requesterUserId: string;
    status: PactJoinRequestStatus;
    respondedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
    /** Present on reads that join the requester — what the creator sees when deciding. */
    requesterUserName?: string;
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
