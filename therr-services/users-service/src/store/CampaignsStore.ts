import KnexBuilder, { Knex } from 'knex';
import { getDbCountQueryString } from 'therr-js-utilities/db';
import formatSQLJoinAsJSON from 'therr-js-utilities/format-sql-join-as-json';
import { IConnection } from './connection';

const knexBuilder: Knex = KnexBuilder({ client: 'pg' });

export const CAMPAIGNS_TABLE_NAME = 'main.campaigns';

interface ITargetLocations {
    latitude: number;
    longitude: number;
    radius: number;
}

export interface ICreateCampaignParams {
    creatorId: string;
    organizationId?: string;
    title: string;
    description: string;
    type: string;
    assetIds?: string[];
    status: string; // active, paused, removed, etc.
    businessSpaceIds?: string[];
    targetDailyBudget: number;
    costBiddingStrategy: string;
    targetLanguages: string[];
    targetLocations?: ITargetLocations[];
    scheduleStartAt: Date;
    scheduleStopAt: Date;
}

export interface IUpdateCampaignConditions {
    id: string;
}

export interface IUpdateCampaignParams {
    organizationId?: string;
    title?: string;
    description?: string;
    type?: string;
    assetIds?: string[];
    status?: string; // active, paused, removed, etc.
    businessSpaceIds?: string[];
    targetDailyBudget?: number;
    costBiddingStrategy?: string;
    targetLanguages?: string[];
    targetLocations?: ITargetLocations[];
    scheduleStartAt?: Date;
    scheduleStopAt?: Date;
}

export default class CampaignsStore {
    db: IConnection;

    constructor(dbConnection) {
        this.db = dbConnection;
    }

    // TODO: This value is incorrect
    // Need to make the search query a transaction and include the count there
    countRecords(params) {
        const queryString = getDbCountQueryString({
            queryBuilder: knexBuilder,
            tableName: CAMPAIGNS_TABLE_NAME,
            params,
            defaultConditions: {},
        });

        return this.db.read.query(queryString).then((response) => response.rows);
    }

    getCampaigns(conditions = {}) {
        const queryString = knexBuilder.select('*')
            .from(CAMPAIGNS_TABLE_NAME)
            .where(conditions)
            .toString();
        return this.db.read.query(queryString).then((response) => response.rows);
    }

    searchCampaigns(userId, conditions: any = {}) {
        const offset = conditions.pagination.itemsPerPage * (conditions.pagination.pageNumber - 1);
        const limit = conditions.pagination.itemsPerPage;

        let queryString: any = knexBuilder
            .select([
                `${CAMPAIGNS_TABLE_NAME}.id`,
                `${CAMPAIGNS_TABLE_NAME}.creatorId`,
                `${CAMPAIGNS_TABLE_NAME}.organizationId`,
                `${CAMPAIGNS_TABLE_NAME}.title`,
                `${CAMPAIGNS_TABLE_NAME}.description`,
                `${CAMPAIGNS_TABLE_NAME}.assetIds`,
                `${CAMPAIGNS_TABLE_NAME}.status`,
                `${CAMPAIGNS_TABLE_NAME}.businessSpaceIds`,
                `${CAMPAIGNS_TABLE_NAME}.targetDailyBudget`,
                `${CAMPAIGNS_TABLE_NAME}.costBiddingStrategy`,
                `${CAMPAIGNS_TABLE_NAME}.targetLanguages`,
                `${CAMPAIGNS_TABLE_NAME}.targetLocations`,
                `${CAMPAIGNS_TABLE_NAME}.scheduleStartAt`,
                `${CAMPAIGNS_TABLE_NAME}.scheduleStopAt`,
                `${CAMPAIGNS_TABLE_NAME}.createdAt`,
                `${CAMPAIGNS_TABLE_NAME}.updatedAt`,
            ])
            .from(CAMPAIGNS_TABLE_NAME)
            .where(`${CAMPAIGNS_TABLE_NAME}.userId`, '=', userId);

        // if (conditions.filterBy && conditions.query) {
        //     const operator = conditions.filterOperator || '=';
        //     const query = operator === 'ilike' ? `%${conditions.query}%` : conditions.query;
        //     queryString = queryString.andWhere(conditions.filterBy, operator, query);
        // }

        queryString = queryString.orderBy(`${CAMPAIGNS_TABLE_NAME}.updatedAt`, conditions.order || 'asc');

        queryString = queryString
            .limit(limit)
            .offset(offset)
            .toString();

        return this.db.read.query(queryString).then((response) => {
            const configuredResponse = formatSQLJoinAsJSON(response.rows, []);
            // delete configuredResponse.requestingUserId;
            // delete configuredResponse.acceptingUserId;
            // delete configuredResponse.requestStatus;
            return configuredResponse;
        });
    }

    createCampaign(params: ICreateCampaignParams) {
        const modifiedParams = {
            ...params,
            assetIds: params.assetIds ? JSON.stringify(params.assetIds) : JSON.stringify([]),
            businessSpaceIds: params.businessSpaceIds ? JSON.stringify(params.businessSpaceIds) : JSON.stringify([]),
            targetLanguages: JSON.stringify(params.targetLanguages),
            targetLocations: params.targetLocations ? JSON.stringify(params.targetLocations) : JSON.stringify([]),
        };
        const queryString = knexBuilder.insert(modifiedParams)
            .into(CAMPAIGNS_TABLE_NAME)
            .returning('*')
            .toString();

        return this.db.write.query(queryString).then((response) => response.rows);
    }

    updateCampaign(conditions: IUpdateCampaignConditions, params: IUpdateCampaignParams) {
        const queryString = knexBuilder.update({
            ...params,
            updatedAt: new Date(),
        })
            .into(CAMPAIGNS_TABLE_NAME)
            .where(conditions)
            .returning('*')
            .toString();

        return this.db.write.query(queryString).then((response) => response.rows);
    }
}