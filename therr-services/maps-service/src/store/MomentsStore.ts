import Knex from 'knex';
import * as countryGeo from 'country-reverse-geocoding';
import formatSQLJoinAsJSON from 'therr-js-utilities/format-sql-join-as-json';
import { IConnection } from './connection';

const knex: Knex = Knex({ client: 'pg' });

const MOMENTS_TABLE_NAME = 'main.moments';

const countryReverseGeo = countryGeo.country_reverse_geocoding();

const MOMENT_PROXIMITY_METERS = 1000;

export interface ICreateMomentParams {
    expiresAt?: any;
    fromUserId: number;
    locale: string;
    isPublic?: boolean;
    message: string;
    notificationMsg?: string;
    mediaIds?: string;
    mentionsIds?: string;
    hashTags?: string;
    maxViews?: number;
    minProximity?: number;
    latitude: number;
    longitude: number;
    radius?: string;
    polygonCoords?: string;
}

export default class MomentsStore {
    db: IConnection;

    constructor(dbConnection) {
        this.db = dbConnection;
    }

    countRecords(params, fromUserIds) {
        let proximityMax = MOMENT_PROXIMITY_METERS;
        if ((params.filterBy && params.filterBy === 'distance') && params.query) {
            proximityMax = params.query;
        }
        let queryString = knex
            .count('*')
            .from(MOMENTS_TABLE_NAME)
            // NOTE: Cast to a geography type to search distance within n meters
            .where(knex.raw(`ST_DWithin(geom, ST_MakePoint(${params.longitude}, ${params.latitude})::geography, ${proximityMax})`));

        if ((params.filterBy && params.filterBy !== 'distance') && params.query) {
            if (params.filterBy === 'fromUserIds') {
                queryString = queryString.andWhere((builder) => { // eslint-disable-line func-names
                    builder.whereIn('fromUserId', fromUserIds);
                });
            } else {
                queryString = queryString.andWhere({
                    [params.filterBy]: params.query || '',
                });
            }
        }

        return this.db.read.query(queryString.toString()).then((response) => response.rows);
    }

    searchMoments(conditions: any = {}, returning, fromUserIds = []) {
        const offset = conditions.pagination.itemsPerPage * (conditions.pagination.pageNumber - 1);
        const limit = conditions.pagination.itemsPerPage;
        let proximityMax = MOMENT_PROXIMITY_METERS;
        if ((conditions.filterBy && conditions.filterBy === 'distance') && conditions.query) {
            proximityMax = conditions.query;
        }
        let queryString: any = knex
            .select((returning && returning.length) ? returning : '*')
            .from(MOMENTS_TABLE_NAME)
            .orderBy(`${MOMENTS_TABLE_NAME}.updatedAt`)
            // NOTE: Cast to a geography type to search distance within n meters
            .where(knex.raw(`ST_DWithin(geom, ST_MakePoint(${conditions.longitude}, ${conditions.latitude})::geography, ${proximityMax})`)); // eslint-disable-line quotes, max-len

        if ((conditions.filterBy && conditions.filterBy !== 'distance') && conditions.query) {
            const operator = conditions.filterOperator || '=';
            const query = operator === 'like' ? `%${conditions.query}%` : conditions.query;

            if (conditions.filterBy === 'fromUserIds') {
                queryString = queryString.andWhere((builder) => { // eslint-disable-line func-names
                    builder.whereIn('fromUserId', fromUserIds);
                });
            } else {
                queryString = queryString.andWhere(conditions.filterBy, operator, query);
            }
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
            mentionsIds: params.mentionsIds || '',
            hashTags: params.hashTags || '',
            maxViews: params.maxViews || 0,
            minProximity: params.minProximity,
            latitude: params.latitude,
            longitude: params.longitude,
            radius: params.radius,
            region: region.code,
            polygonCoords: params.polygonCoords ? JSON.stringify(params.polygonCoords) : JSON.stringify([]),
            geom: knex.raw(`ST_SetSRID(ST_MakePoint(${params.longitude}, ${params.latitude}), 4326)`),
        };

        const queryString = knex.insert(modifiedParams)
            .into(MOMENTS_TABLE_NAME)
            .returning('*')
            .toString();

        return this.db.write.query(queryString).then((response) => response.rows);
    }
}
