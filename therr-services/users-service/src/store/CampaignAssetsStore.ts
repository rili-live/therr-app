import KnexBuilder, { Knex } from 'knex';
import { IConnection } from './connection';

const knexBuilder: Knex = KnexBuilder({ client: 'pg' });

export const CAMPAIGN_ASSETS_TABLE_NAME = 'main.campaignAssets';

export interface ICreateCampaignAssetParams {
    creatorId: string;
    campaignId?: string;
    organizationId?: string;
    mediaId?: string;
    status?: string;// processing and AI status (accepted, optimized, rejected, etc.)
    type: string; // text, image, video, etc.
    headline?: string; // if type is text
    longText?: string; // if type is text
}

export interface IUpdateCampaignAssetParams {
    campaignId?: string;
    organizationId?: string;
    status?: string;// processing and AI status (accepted, optimized, rejected, etc.)
    type?: string; // text, image, video, etc.
    headline?: string; // if type is text
    longText?: string; // if type is text
}

export default class CampaignAssetsStore {
    db: IConnection;

    constructor(dbConnection) {
        this.db = dbConnection;
    }

    get(conditions: { userId?: string, organizationId?: string }) {
        const queryString = knexBuilder.select()
            .from(CAMPAIGN_ASSETS_TABLE_NAME)
            .where(conditions)
            .toString();

        return this.db.read.query(queryString).then((response) => response.rows);
    }

    getById(id: string) {
        const queryString = knexBuilder.select()
            .from(CAMPAIGN_ASSETS_TABLE_NAME)
            .where({ id })
            .toString();

        return this.db.read.query(queryString).then((response) => response.rows[0]);
    }

    create(paramsList: ICreateCampaignAssetParams[]) {
        const queryString = knexBuilder.insert(paramsList)
            .into(CAMPAIGN_ASSETS_TABLE_NAME)
            .returning('*')
            .toString();

        return this.db.write.query(queryString).then((response) => response.rows);
    }

    update(id: string, params: IUpdateCampaignAssetParams) {
        const queryString = knexBuilder.where({ id })
            .update(params)
            .into(CAMPAIGN_ASSETS_TABLE_NAME)
            .returning('*')
            .toString();

        return this.db.write.query(queryString).then((updateResponse) => updateResponse.rows);
    }

    delete(id: string) {
        const queryString = knexBuilder.where({ id })
            .delete()
            .from(CAMPAIGN_ASSETS_TABLE_NAME)
            .returning('*')
            .toString();

        return this.db.write.query(queryString).then((updateResponse) => updateResponse.rows);
    }
}
