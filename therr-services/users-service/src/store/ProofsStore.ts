import KnexBuilder, { Knex } from 'knex';
import { IConnection } from './connection';
import { PROOFS_TABLE_NAME } from './tableNames';

const knexBuilder: Knex = KnexBuilder({ client: 'pg' });

export interface ICreateProofParams {
    userId: string;
    checkinId: string;
    habitGoalId: string;
    pactId?: string;
    mediaType: 'image' | 'video';
    mediaPath: string;
    thumbnailPath?: string;
    fileSizeBytes?: number;
    durationSeconds?: number;
    capturedAt?: Date;
}

export default class ProofsStore {
    db: IConnection;

    constructor(dbConnection: IConnection) {
        this.db = dbConnection;
    }

    getByCheckinId(checkinId: string) {
        const queryString = knexBuilder
            .from(PROOFS_TABLE_NAME)
            .where({ checkinId })
            .orderBy('createdAt', 'asc')
            .toString();

        return this.db.read.query(queryString).then((response) => response.rows);
    }

    createMany(params: ICreateProofParams[]) {
        if (!params.length) {
            return Promise.resolve([]);
        }

        const queryString = knexBuilder
            .insert(params.map((p) => ({
                ...p,
                verificationStatus: 'pending',
            })))
            .into(PROOFS_TABLE_NAME)
            .returning('*')
            .toString();

        return this.db.write.query(queryString).then((response) => response.rows);
    }

    /**
     * Record what the content check decided about one proof.
     *
     * Separate from `createMany` because the check is asynchronous and must not
     * hold up the check-in — see `utilities/moderateProofs`. Rows therefore live
     * briefly at their insert defaults (`pending` / `isSafeForWork: true`), which
     * is why nothing that exposes a proof beyond its owner may read
     * `isSafeForWork` alone: `verificationStatus === 'auto_verified'` is the
     * signal that a check actually ran.
     */
    setModerationResult(proofId: string, params: {
        isSafeForWork: boolean;
        verificationStatus: string;
        moderationFlags?: Record<string, unknown>;
    }) {
        // `moderationFlags` is omitted rather than nulled when absent. Writing null would
        // make a later check that reports no flags erase what an earlier one recorded —
        // the column is the audit trail for why a proof was flagged, so losing it is worse
        // than leaving a stale entry that `verifiedAt` already dates.
        const modifiedParams: Record<string, unknown> = {
            isSafeForWork: params.isSafeForWork,
            verificationStatus: params.verificationStatus,
            verifiedAt: new Date(),
            updatedAt: new Date(),
        };

        if (params.moderationFlags) {
            modifiedParams.moderationFlags = JSON.stringify(params.moderationFlags);
        }

        const queryString = knexBuilder
            .where({ id: proofId })
            .update(modifiedParams)
            .into(PROOFS_TABLE_NAME)
            .returning('*')
            .toString();

        return this.db.write.query(queryString).then((response) => response.rows[0]);
    }

    deleteByCheckinId(checkinId: string) {
        const queryString = knexBuilder
            .where({ checkinId })
            .delete()
            .into(PROOFS_TABLE_NAME)
            .returning('*')
            .toString();

        return this.db.write.query(queryString).then((response) => response.rows);
    }
}
