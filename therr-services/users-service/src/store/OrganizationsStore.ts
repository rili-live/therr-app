import KnexBuilder, { Knex } from 'knex';
import { IConnection } from './connection';
import { ORGANIZATIONS_TABLE_NAME } from './tableNames';

const knexBuilder: Knex = KnexBuilder({ client: 'pg' });

export interface ICreateOrganizationParams {
    creatorId: string;
    name: string;
    description: string;
    settingsGeneralBusinessType?: string;
    businessIndustry?: string;
    isAgency?: boolean;
}

export default class OrganizationsStore {
    db: IConnection;

    constructor(dbConnection) {
        this.db = dbConnection;
    }

    count(creatorId?: string) {
        const queryString = knexBuilder.count('*')
            .from(ORGANIZATIONS_TABLE_NAME)
            .where({
                creatorId,
            })
            .toString();

        return this.db.read.query(queryString).then((response) => response.rows);
    }

    get(conditions: { id?: string, creatorId?: string }) {
        const queryString = knexBuilder.select()
            .from(ORGANIZATIONS_TABLE_NAME)
            .where(conditions)
            .toString();

        return this.db.read.query(queryString).then((response) => response.rows);
    }

    getById(id: string) {
        const queryString = knexBuilder.select()
            .from(ORGANIZATIONS_TABLE_NAME)
            .where({ id })
            .toString();

        return this.db.read.query(queryString).then((response) => response.rows[0]);
    }

    create(paramsList: ICreateOrganizationParams[]) {
        const queryString = knexBuilder.insert(paramsList)
            .into(ORGANIZATIONS_TABLE_NAME)
            .returning('*')
            .toString();

        return this.db.write.query(queryString).then((response) => response.rows);
    }

    update(id: string, params: any) {
        const queryString = knexBuilder.where({ id })
            .update({
                ...params,
                updatedAt: new Date(),
            })
            .into(ORGANIZATIONS_TABLE_NAME)
            .returning('*')
            .toString();

        return this.db.write.query(queryString).then((updateResponse) => updateResponse.rows);
    }
}
