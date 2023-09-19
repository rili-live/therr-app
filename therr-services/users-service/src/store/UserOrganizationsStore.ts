import KnexBuilder, { Knex } from 'knex';
import { AccessLevels } from 'therr-js-utilities/constants';
import { IConnection } from './connection';

const knexBuilder: Knex = KnexBuilder({ client: 'pg' });

export const USER_ORGANIZATIONS_TABLE_NAME = 'main.userOrganizations';

export interface ICreateUserOrganizationParams {
    userId: string;
    organizationId: string;
    inviteStatus: string;
    isEnabled?: boolean;
    accessLevels?: any[AccessLevels];
}

export default class UserOrganizationsStore {
    db: IConnection;

    constructor(dbConnection) {
        this.db = dbConnection;
    }

    get(conditions: { userId?: string, organizationId?: string }) {
        const queryString = knexBuilder.select()
            .from(USER_ORGANIZATIONS_TABLE_NAME)
            .where(conditions)
            .toString();

        return this.db.read.query(queryString).then((response) => response.rows);
    }

    getById(id: string) {
        const queryString = knexBuilder.select()
            .from(USER_ORGANIZATIONS_TABLE_NAME)
            .where({ id })
            .toString();

        return this.db.read.query(queryString).then((response) => response.rows[0]);
    }

    create(paramsList: ICreateUserOrganizationParams[]) {
        const queryString = knexBuilder.insert(paramsList)
            .into(USER_ORGANIZATIONS_TABLE_NAME)
            .returning('*')
            .toString();

        return this.db.write.query(queryString).then((response) => response.rows);
    }

    update(id: string, params: any) {
        const queryString = knexBuilder.where({ id })
            .update(params)
            .into(USER_ORGANIZATIONS_TABLE_NAME)
            .returning('*')
            .toString();

        return this.db.write.query(queryString).then((updateResponse) => updateResponse.rows);
    }
}
