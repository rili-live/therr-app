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
        const queryString = knexBuilder
            .where({ id: proofId })
            .update({
                isSafeForWork: params.isSafeForWork,
                verificationStatus: params.verificationStatus,
                moderationFlags: params.moderationFlags ? JSON.stringify(params.moderationFlags) : null,
                verifiedAt: new Date(),
                updatedAt: new Date(),
            })
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
