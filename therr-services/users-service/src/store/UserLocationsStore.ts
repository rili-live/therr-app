import KnexBuilder, { Knex } from 'knex';
// import formatSQLJoinAsJSON from 'therr-js-utilities/format-sql-join-as-json';
import { IConnection } from './connection';
import { USER_LOCATIONS_TABLE_NAME } from './tableNames';

const knexBuilder: Knex = KnexBuilder({ client: 'pg' });
export interface ICreateUserLocationParams {
    userId: string;
    isDeclaredHome?: boolean;
    latitude: number;
    longitude: number;
    latitudeRounded?: number;
    longitudeRounded?: number;
    visitCount?: number;
}

export default class UserLocationsStore {
    db: IConnection;

    constructor(dbConnection) {
        this.db = dbConnection;
    }

    get(conditions: { userId?: string }, limit = 10) {
        const queryString = knexBuilder
            .select([
                `${USER_LOCATIONS_TABLE_NAME}.*`,
            ])
            .from(USER_LOCATIONS_TABLE_NAME)
            .where(conditions)
            .limit(limit)
            .toString();

        return this.db.read.query(queryString)
            .then((response) => response.rows);
    }

    getById(id: string) {
        const queryString = knexBuilder.select()
            .from(USER_LOCATIONS_TABLE_NAME)
            .where({ id })
            .toString();

        return this.db.read.query(queryString).then((response) => response.rows[0]);
    }

    create(paramsList: ICreateUserLocationParams[]) {
        const modifiedParamsList = paramsList.map((params) => {
            const modified: ICreateUserLocationParams = {
                ...params,
                isDeclaredHome: params?.isDeclaredHome || false,
                latitudeRounded: params?.latitudeRounded || Math.round(params.latitude * 1000) / 1000,
                longitudeRounded: params?.longitudeRounded || Math.round(params.longitude * 1000) / 1000,
                visitCount: params?.visitCount || 1,
            };

            return modified;
        });
        const queryString = knexBuilder.insert(modifiedParamsList)
            .into(USER_LOCATIONS_TABLE_NAME)
            .onConflict(['userId', 'latitudeRounded', 'longitudeRounded'])
            .merge({
                visitCount: knexBuilder.raw('?? + ?', [`${USER_LOCATIONS_TABLE_NAME}.visitCount`, 1]),
            })
            .returning('*')
            .toString();

        return this.db.write.query(queryString).then((response) => response.rows);
    }

    update(id: string, params: any) {
        const queryString = knexBuilder.where({ id })
            .update(params)
            .into(USER_LOCATIONS_TABLE_NAME)
            .returning('*')
            .toString();

        return this.db.write.query(queryString).then((updateResponse) => updateResponse.rows);
    }
}
