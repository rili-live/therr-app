import KnexBuilder, { Knex } from 'knex';
import * as countryGeo from 'country-reverse-geocoding';
import { MetricNames, MetricValueTypes } from 'therr-js-utilities/constants';
// import formatSQLJoinAsJSON from 'therr-js-utilities/format-sql-join-as-json';
import { IConnection } from './connection';

const knexBuilder: Knex = KnexBuilder({ client: 'pg' });

export const SPACE_METRICS_TABLE_NAME = 'main.spaceMetrics';

const countryReverseGeo = countryGeo.country_reverse_geocoding();
export interface ICreateSpaceMetricsParams {
    name: MetricNames;
    spaceId: string;
    value: string;
    valueType: MetricValueTypes;
    userId?: string;
    dimensions?: {
        [key: string]: string;
    } | string,
    region?: string;
    userLatitude?: number;
    userLongitude?: number;
}

interface ILongLat {
    latitude: number;
    longitude: number;
}

export default class SpaceMetricsStore {
    db: IConnection;

    constructor(dbConnection) {
        this.db = dbConnection;
    }

    get(filters) {
        // hard limit to prevent overloading client
        const query = knexBuilder
            .from(SPACE_METRICS_TABLE_NAME)
            .where(filters);

        return this.db.read.query(query.toString()).then((response) => response.rows);
    }

    getForDateRange(startDate, endDate, filters, metricNames = [MetricNames.SPACE_VISIT, MetricNames.SPACE_IMPRESSION, MetricNames.SPACE_PROSPECT]) {
        // hard limit to prevent overloading client
        const query = knexBuilder
            .from(SPACE_METRICS_TABLE_NAME)
            .where(filters)
            .whereIn('name', metricNames)
            .andWhere('createdAt', '>=', startDate)
            .andWhere('createdAt', '<=', endDate);

        return this.db.read.query(query.toString()).then((response) => response.rows);
    }

    create(params: ICreateSpaceMetricsParams[], longLat: ILongLat) {
        const region = countryReverseGeo.get_country(longLat.latitude, longLat.longitude);

        const modifiedParams = params.map((p) => {
            const insert: ICreateSpaceMetricsParams = {
                ...p,
                region: region.code,
            };

            if (insert.dimensions && typeof insert.dimensions !== 'string') {
                insert.dimensions = JSON.stringify(insert.dimensions);
            }

            if (p.userLatitude != null && p.userLongitude != null) {
                insert.userLatitude = p.userLatitude;
                insert.userLongitude = p.userLongitude;
                (insert as any).userLocation = knexBuilder.raw(`ST_SetSRID(ST_MakePoint(${p.userLongitude}, ${p.userLatitude}), 4326)`);
            }

            return insert;
        });

        const queryString = knexBuilder.insert(modifiedParams)
            .into(SPACE_METRICS_TABLE_NAME)
            .returning('*')
            .toString();

        return this.db.write.query(queryString).then((response) => response.rows);
    }
}
