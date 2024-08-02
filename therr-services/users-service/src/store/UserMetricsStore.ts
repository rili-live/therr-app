import KnexBuilder, { Knex } from 'knex';
import * as countryGeo from 'country-reverse-geocoding';
import { MetricNames, MetricValueTypes } from 'therr-js-utilities/constants';
// import formatSQLJoinAsJSON from 'therr-js-utilities/format-sql-join-as-json';
import { IConnection } from './connection';

const knexBuilder: Knex = KnexBuilder({ client: 'pg' });

export const USER_METRICS_TABLE_NAME = 'main.userMetrics';

const countryReverseGeo = countryGeo.country_reverse_geocoding();
export interface ICreateUserMetricsParams {
    name: MetricNames;
    userId: string;
    region?: string;
    latitude?: number;
    longitude?: number;
    value: string;
    valueType: MetricValueTypes;
    contentUserId?: string;
    dimensions?: {
        [key: string]: string;
    } | string,
}

interface ILongLat {
    latitude: number;
    longitude: number;
}

export default class UserMetricsStore {
    db: IConnection;

    constructor(dbConnection) {
        this.db = dbConnection;
    }

    get(filters) {
        // hard limit to prevent overloading client
        const query = knexBuilder
            .from(USER_METRICS_TABLE_NAME)
            .where(filters);

        return this.db.read.query(query.toString()).then((response) => response.rows);
    }

    countWhere(
        dimensionKey: string, // thoughtId, momentId, etc
        dimensionValue: string,
        conditions = {},
    ) {
        // hard limit to prevent overloading client
        const query = knexBuilder
            .count()
            .from((builder: KnexBuilder.Knex<any, any[]>) => {
                builder.distinct('userId')
                    .from(USER_METRICS_TABLE_NAME)
                    // eslint-disable-next-line quotes
                    .whereRaw(`dimensions->>'${dimensionKey}' = ?`, [dimensionValue])
                    .as('sub_query');
            })
            .where(conditions);

        return this.db.read.query(query.toString()).then((response) => response.rows);
    }

    getForDateRange(startDate, endDate, filters) {
        // hard limit to prevent overloading client
        const query = knexBuilder
            .from(USER_METRICS_TABLE_NAME)
            .where(filters)
            .andWhere('createdAt', '>=', startDate)
            .andWhere('createdAt', '<=', endDate);

        return this.db.read.query(query.toString()).then((response) => response.rows);
    }

    create(params: ICreateUserMetricsParams, longLat?: ILongLat) {
        let region;
        if (longLat) {
            region = countryReverseGeo.get_country(longLat.latitude, longLat.longitude);
        }

        const modifiedParams: ICreateUserMetricsParams = {
            ...params,
            region: region ? region.code : undefined,
            latitude: longLat?.latitude,
            longitude: longLat?.longitude,
        };

        if (modifiedParams.dimensions && typeof modifiedParams.dimensions !== 'string') {
            modifiedParams.dimensions = JSON.stringify(modifiedParams.dimensions);
        }

        const queryString = knexBuilder.insert(modifiedParams)
            .into(USER_METRICS_TABLE_NAME)
            .returning('*')
            .toString();

        return this.db.write.query(queryString).then((response) => response.rows);
    }
}
