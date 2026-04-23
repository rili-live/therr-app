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
