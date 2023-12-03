import KnexBuilder, { Knex } from 'knex';
import { CampaignAssetTypes } from 'therr-js-utilities/constants';
import { IConnection } from './connection';

const knexBuilder: Knex = KnexBuilder({ client: 'pg' });

export const CAMPAIGN_ASSETS_TABLE_NAME = 'main.campaignAssets';

export interface ICreateCampaignAssetParams {
    creatorId: string;
    organizationId?: string;
    media?: {
        [key: string]: any;
    };
    spaceId?: string;
    status: string;// processing and AI status (accepted, optimized, rejected, etc.)
    type: CampaignAssetTypes; // text, image, video, space, etc.
    headline?: string; // if type is text
    longText?: string; // if type is text
    performance: string; // performance rating (worst, bad, learning, good, best)
    goal: string;
    linkUrl?: string;
    urlParams?: string;
    audiences?: any[]; // Add more typing
    integrationAssociations?: {
        [key: string]: any;
    };
    languages?: string[];
}

export interface IUpdateCampaignAssetParams {
    organizationId?: string;
    media?: {
        [key: string]: any;
    };
    status?: string;// processing and AI status (accepted, optimized, rejected, etc.)
    type?: CampaignAssetTypes; // text, image, video, etc.
    headline?: string; // if type is text
    longText?: string; // if type is text
    performance?: string; // performance rating (worst, bad, learning, good, best)
    goal?: string;
    linkUrl?: string;
    urlParams?: string;
    audiences?: any[]; // Add more typing
    integrationAssociations?: {
        [key: string]: any;
    };
    languages?: string[];
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

    getByIds(ids: string[]) {
        const queryString = knexBuilder.select()
            .from(CAMPAIGN_ASSETS_TABLE_NAME)
            .whereIn('id', ids)
            .toString();

        return this.db.read.query(queryString).then((response) => response.rows);
    }

    create(paramsList: ICreateCampaignAssetParams[]) {
        const modifiedParamsList = paramsList.map((params) => ({
            ...params,
            audiences: params.audiences ? JSON.stringify(params.audiences) : JSON.stringify([]),
            integrationAssociations: params.integrationAssociations ? JSON.stringify(params.integrationAssociations) : JSON.stringify({}),
            languages: params.languages ? JSON.stringify(params.languages) : JSON.stringify(['en-us']),
            media: params.media ? JSON.stringify(params.media) : JSON.stringify({}),
        }));
        const queryString = knexBuilder.insert(modifiedParamsList)
            .into(CAMPAIGN_ASSETS_TABLE_NAME)
            .returning('*')
            .toString();

        return this.db.write.query(queryString).then((response) => response.rows);
    }

    update(id: string, params: IUpdateCampaignAssetParams) {
        const sanitizedParams = {
            ...params,
            audiences: params.audiences ? JSON.stringify(params.audiences) : undefined,
            integrationAssociations: params.integrationAssociations ? JSON.stringify(params.integrationAssociations) : undefined,
            languages: params.languages ? JSON.stringify(params.languages) : undefined,
            media: params.media ? JSON.stringify(params.media) : undefined,
            updatedAt: new Date(),
        };
        const queryString = knexBuilder.where({ id })
            .update(sanitizedParams)
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
