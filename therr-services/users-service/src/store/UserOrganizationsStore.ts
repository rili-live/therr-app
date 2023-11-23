import KnexBuilder, { Knex } from 'knex';
import { AccessLevels } from 'therr-js-utilities/constants';
import formatSQLJoinAsJSON from 'therr-js-utilities/format-sql-join-as-json';
import { IConnection } from './connection';
import { ORGANIZATIONS_TABLE_NAME, USER_ORGANIZATIONS_TABLE_NAME } from './tableNames';

const knexBuilder: Knex = KnexBuilder({ client: 'pg' });
export interface ICreateUserOrganizationParams {
    userId: string;
    organizationId: string;
    inviteStatus: string;
    isEnabled?: boolean;
    accessLevels?: AccessLevels[];
}

export default class UserOrganizationsStore {
    db: IConnection;

    constructor(dbConnection) {
        this.db = dbConnection;
    }

    get(conditions: { userId?: string, organizationId?: string }) {
        const whereConditions = {};
        if (conditions.userId) {
            whereConditions[`${USER_ORGANIZATIONS_TABLE_NAME}.userId`] = conditions.userId;
        }
        if (conditions.organizationId) {
            whereConditions[`${USER_ORGANIZATIONS_TABLE_NAME}.organizationId`] = conditions.organizationId;
        }
        const queryString = knexBuilder
            .select([
                `${USER_ORGANIZATIONS_TABLE_NAME}.*`,
            ])
            .from(USER_ORGANIZATIONS_TABLE_NAME)
            .innerJoin(ORGANIZATIONS_TABLE_NAME, `${USER_ORGANIZATIONS_TABLE_NAME}.organizationId`, `${ORGANIZATIONS_TABLE_NAME}.id`)
            .columns([
                `${ORGANIZATIONS_TABLE_NAME}.name as organizationName`,
                `${ORGANIZATIONS_TABLE_NAME}.settingsGeneralBusinessType as organizationBusinessType`,
                `${ORGANIZATIONS_TABLE_NAME}.businessIndustry as organizationIndustry`,
                `${ORGANIZATIONS_TABLE_NAME}.isAgency as organizationIsAgency`,
                `${ORGANIZATIONS_TABLE_NAME}.creatorId as organizationCreatorId`,
            ])
            .where(whereConditions)
            .toString();

        return this.db.read.query(queryString)
            .then((response) => response.rows);
    }

    getById(id: string) {
        const queryString = knexBuilder.select()
            .from(USER_ORGANIZATIONS_TABLE_NAME)
            .where({ id })
            .toString();

        return this.db.read.query(queryString).then((response) => response.rows[0]);
    }

    create(paramsList: ICreateUserOrganizationParams[]) {
        const modifiedParamsList = paramsList.map((params) => {
            const modified: any = {
                ...params,
            };
            if (params.accessLevels) {
                modified.accessLevels = JSON.stringify(params.accessLevels);
            }

            return modified;
        });
        const queryString = knexBuilder.insert(modifiedParamsList)
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
