import KnexBuilder, { Knex } from 'knex';
import { IConnection } from './connection';

const knexBuilder: Knex = KnexBuilder({ client: 'pg' });

export const SOCIAL_SYNCS_TABLE_NAME = 'main.socialSyncs';

export interface ICreateOrUpdateParams {
    userId: string;
    platform: string;
    platformUsername?: string;
    platformUserId?: string;
    link: string;
    displayName?: string;
    followerCount?: string;
    customIconFilename?: string;
    updatedAt?: string;
}

export default class SocialSyncsStore {
    db: IConnection;

    constructor(dbConnection) {
        this.db = dbConnection;
    }

    createOrUpdateSyncs(params: ICreateOrUpdateParams[]) {
        const sanitizedSyncs = params.map((socialSync: ICreateOrUpdateParams) => ({
            ...socialSync,
            updatedAt: new Date(),
        }));
        const queryString = knexBuilder.insert(sanitizedSyncs)
            .into(SOCIAL_SYNCS_TABLE_NAME)
            .onConflict(['userId', 'link'])
            .merge()
            .returning('*')
            .toString();

        return this.db.write.query(queryString).then((response) => response.rows);
    }
}
