import KnexBuilder, { Knex } from 'knex';
import { IConnection } from './connection';

const knexBuilder: Knex = KnexBuilder({ client: 'pg' });

export const CAMPAIGN_AD_GROUPS_TABLE_NAME = 'main.campaignAdGroups';

export interface ICreateCampaignAdGroupParams {
    campaignId: string;
    creatorId: string;
    organizationId?: string;
    spaceId?: string;
    status?: string;// processing and AI status (accepted, optimized, rejected, etc.)
    headline?: string; // if type is text
    description?: string; // if type is text
    performance: string; // performance rating (worst, bad, learning, good, best)
    goal: string;
    linkUrl?: string;
    urlParams?: string;
    audiences?: any[]; // Add more typing
    assetIds?: string[];
    integrationAssociations?: {
        [key: string]: any;
    };
    languages?: string[];
    scheduleStartAt: Date;
    scheduleStopAt: Date;
}

export interface IUpdateCampaignAdGroupParams {
    campaignId: string;
    organizationId?: string;
    status?: string;// processing and AI status (accepted, optimized, rejected, etc.)
    headline?: string; // if type is text
    description?: string; // if type is text
    performance?: string; // performance rating (worst, bad, learning, good, best)
    goal?: string;
    linkUrl?: string;
    urlParams?: string;
    audiences?: any[]; // Add more typing
    assetIds?: string[];
    integrationAssociations?: {
        [key: string]: any;
    };
    languages?: string[];
    scheduleStartAt?: Date;
    scheduleStopAt?: Date;
}

export default class CampaignAdGroupsStore {
    db: IConnection;

    constructor(dbConnection) {
        this.db = dbConnection;
    }

    get(conditions: { id?: string, userId?: string, campaignId?: string, organizationId?: string }, ids?: string[]) {
        let queryString = knexBuilder.select()
            .from(CAMPAIGN_AD_GROUPS_TABLE_NAME)
            .where(conditions);

        if (ids) {
            queryString = queryString.whereIn('id', ids);
        }

        return this.db.read.query(queryString.toString()).then((response) => response.rows);
    }

    getById(id: string) {
        const queryString = knexBuilder.select()
            .from(CAMPAIGN_AD_GROUPS_TABLE_NAME)
            .where({ id })
            .toString();

        return this.db.read.query(queryString).then((response) => response.rows[0]);
    }

    create(paramsList: ICreateCampaignAdGroupParams[]) {
        const modifiedParamsList = paramsList.map((params) => ({
            ...params,
            assetIds: params.assetIds ? JSON.stringify(params.assetIds) : JSON.stringify([]),
            audiences: params.audiences ? JSON.stringify(params.audiences) : JSON.stringify([]),
            integrationAssociations: params.integrationAssociations ? JSON.stringify(params.integrationAssociations) : JSON.stringify({}),
            languages: params.languages ? JSON.stringify(params.languages) : JSON.stringify(['en-us']),
        }));
        const queryString = knexBuilder.insert(modifiedParamsList)
            .into(CAMPAIGN_AD_GROUPS_TABLE_NAME)
            .returning('*')
            .toString();

        return this.db.write.query(queryString).then((response) => response.rows);
    }

    update(id: string, params: IUpdateCampaignAdGroupParams) {
        const queryString = knexBuilder.where({ id })
            .update({
                ...params,
                updatedAt: new Date(),
                assetIds: params.assetIds ? JSON.stringify(params.assetIds) : undefined,
                audiences: params.audiences ? JSON.stringify(params.audiences) : undefined,
                integrationAssociations: params.integrationAssociations ? JSON.stringify(params.integrationAssociations) : undefined,
                languages: params.languages ? JSON.stringify(params.languages) : undefined,
            })
            .into(CAMPAIGN_AD_GROUPS_TABLE_NAME)
            .returning('*')
            .toString();

        return this.db.write.query(queryString).then((updateResponse) => updateResponse.rows);
    }

    delete(id: string) {
        const queryString = knexBuilder.where({ id })
            .delete()
            .from(CAMPAIGN_AD_GROUPS_TABLE_NAME)
            .returning('*')
            .toString();

        return this.db.write.query(queryString).then((updateResponse) => updateResponse.rows);
    }
}
