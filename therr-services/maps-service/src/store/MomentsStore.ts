import Knex from 'knex';
import * as countryGeo from 'country-reverse-geocoding';
import { getDbCountQueryString } from 'therr-js-utilities/db';
import formatSQLJoinAsJSON from 'therr-js-utilities/format-sql-join-as-json';
import { IConnection } from './connection';

const knex: Knex = Knex({ client: 'pg' });

const MOMENTS_TABLE_NAME = 'main.moments';

const countryReverseGeo = countryGeo.country_reverse_geocoding();

const MOMENT_PROXIMITY_METERS = 25;

export interface ICreateMomentParams {
    expiresAt?: any;
    fromUserId: number;
    locale: string;
    isPublic?: boolean;
    message: string;
    notificationMsg?: string;
    mediaIds?: string;
    mentionIds?: string;
    hashTags?: string;
    maxViews?: number;
    latitude: string;
    longitude: string;
    radius?: string;
    polygonCoords?: string;
}

export default class MomentsStore {
    db: IConnection;

    constructor(dbConnection) {
        this.db = dbConnection;
    }

    countRecords(params) {
        const queryString = getDbCountQueryString({
            queryBuilder: knex,
            tableName: MOMENTS_TABLE_NAME,
            params,
            defaultConditions: {},
        });

        return this.db.read.query(queryString).then((response) => response.rows);
    }

    searchMoments(conditions: any = {}, returning) {
        const offset = conditions.pagination.itemsPerPage * (conditions.pagination.pageNumber - 1);
        const limit = conditions.pagination.itemsPerPage;
        let queryString: any = knex
            .select([...returning, 'geom'] || '*')
            .from(MOMENTS_TABLE_NAME)
            .orderBy(`${MOMENTS_TABLE_NAME}.updatedAt`);

        if (conditions.filterBy && conditions.query) {
            const operator = conditions.filterOperator || '=';
            const query = operator === 'like' ? `%${conditions.query}%` : conditions.query;
            // NOTE: Cast to a geography type to search distance within n meters
            queryString = queryString
                .where(knex.raw(`ST_DWithin(geom, ST_MakePoint(${conditions.longitude}, ${conditions.latitude})::geography, ${MOMENT_PROXIMITY_METERS});`)) // eslint-disable-line quotes, max-len
                .andWhere(conditions.filterBy, operator, query);
        }

        queryString = queryString
            .limit(limit)
            .offset(offset)
            .toString();

        return this.db.read.query(queryString).then((response) => {
            const configuredResponse = formatSQLJoinAsJSON(response.rows, []);
            return configuredResponse;
        });
    }

    createMoment(params: ICreateMomentParams) {
        const region = countryReverseGeo.get_country(params.latitude, params.longitude);
        const modifiedParams = {
            expiresAt: params.expiresAt,
            fromUserId: params.fromUserId,
            locale: params.locale,
            isPublic: !!params.isPublic,
            message: params.message,
            notificationMsg: params.notificationMsg ? `${params.notificationMsg.substring(0, 25)}...` : `${params.message.substring(0, 25)}...`,
            mediaIds: params.mediaIds || '',
            mentionIds: params.mentionIds || '',
            hashTags: params.hashTags || '',
            maxViews: params.maxViews || 0,
            latitude: params.latitude,
            longitude: params.longitude,
            radius: params.radius,
            region,
            polygonCoords: params.polygonCoords ? JSON.stringify(params.polygonCoords) : JSON.stringify([]),
        };

        const queryString = knex.insert(modifiedParams)
            .into(MOMENTS_TABLE_NAME)
            .returning(['id'])
            .toString();

        return this.db.write.query(queryString).then((response) => response.rows);
    }
}
