import KnexBuilder, { Knex } from 'knex';
import { IConnection } from './connection';

const knexBuilder: Knex = KnexBuilder({ client: 'pg' });

export const CAMPAIGN_ASSETS_TABLE_NAME = 'main.campaignAssets';

export interface ICreateCampaignAssetParams {
    creatorId: string;
    organizationId?: string;
    mediaId?: string;
    spaceId?: string;
    status?: string;// processing and AI status (accepted, optimized, rejected, etc.)
    type: string; // text, image, video, space, etc.
    headline?: string; // if type is text
    longText?: string; // if type is text
    performance: string; // performance rating (worst, bad, learning, good, best)
}

export interface IUpdateCampaignAssetParams {
    organizationId?: string;
    status?: string;// processing and AI status (accepted, optimized, rejected, etc.)
    type?: string; // text, image, video, etc.
    headline?: string; // if type is text
    longText?: string; // if type is text
    performance?: string; // performance rating (worst, bad, learning, good, best)
}

export default class CampaignAssetsStore {
    db: IConnection;

    constructor(dbConnection) {
        this.db = dbConnection;
    }

    get(conditions: { id?: string, userId?: string, organizationId?: string }, ids?: string[]) {
        let queryString = knexBuilder.select()
            .from(CAMPAIGN_ASSETS_TABLE_NAME)
            .where(conditions);

        if (ids) {
            queryString = queryString.whereIn('id', ids);
        }

        return this.db.read.query(queryString.toString()).then((response) => response.rows);
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
