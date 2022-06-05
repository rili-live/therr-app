import KnexBuilder, { Knex } from 'knex';
import { IConnection } from './connection';

const knexBuilder: Knex = KnexBuilder({ client: 'pg' });

export const EXTERNAL_MEDIA_INTEGRATIONS_TABLE_NAME = 'main.externalMediaIntegrations';
export interface ICreateExternalMediaIntegrationParams {
    fromUserId: number;
    momentId: string;
    externalId: string;
    platform: string;
    permalink?: string;
    priority?: number;
    weight?: number;
}

export default class ExternalMediaIntegrationsStore {
    db: IConnection;

    constructor(dbConnection) {
        this.db = dbConnection;
    }

    create(params: ICreateExternalMediaIntegrationParams) {
        const queryString = knexBuilder.insert(params)
            .into(EXTERNAL_MEDIA_INTEGRATIONS_TABLE_NAME)
            .returning(['id'])
            .toString();

        return this.db.write.query(queryString).then((response) => response.rows[0]);
    }

    get(params) {
        const queryString = knexBuilder.select('*')
            .from(EXTERNAL_MEDIA_INTEGRATIONS_TABLE_NAME)
            .where(params)
            .toString();

        return this.db.write.query(queryString).then((response) => response.rows);
    }
}
