import KnexBuilder, { Knex } from 'knex';
import { IConnection } from './connection';

const knexBuilder: Knex = KnexBuilder({ client: 'pg' });

export const MEDIA_TABLE_NAME = 'main.media';
export interface ICreateMediaParams {
    fromUserId: number;
    altText: string;
    type: string;
    path: string;
}

export default class MediaStore {
    db: IConnection;

    constructor(dbConnection) {
        this.db = dbConnection;
    }

    create(params: ICreateMediaParams) {
        const queryString = knexBuilder.insert(params)
            .into(MEDIA_TABLE_NAME)
            .returning(['id'])
            .toString();

        return this.db.write.query(queryString).then((response) => response.rows.map((row) => row.id));
    }

    get(mediaIds: string[]) {
        const queryString = knexBuilder.select('*')
            .from(MEDIA_TABLE_NAME)
            .whereIn('id', mediaIds)
            .toString();

        return this.db.write.query(queryString).then((response) => response.rows);
    }
}
