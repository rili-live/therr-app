import KnexBuilder, { Knex } from 'knex';
import { AccessLevels } from 'therr-js-utilities/constants';
import formatSQLJoinAsJSON from 'therr-js-utilities/format-sql-join-as-json';
import { IConnection } from './connection';
import { USER_GROUPS_TABLE_NAME } from './tableNames';

const knexBuilder: Knex = KnexBuilder({ client: 'pg' });
export interface ICreateUserGroupParams {
    userId: string;
    groupId: string;
    role: string;
    status: string;
    shouldMuteNotifs?: boolean;
    shouldShareLocation?: boolean;
    engagementCount?: number;
}

export default class UserGroupsStore {
    db: IConnection;

    constructor(dbConnection) {
        this.db = dbConnection;
    }

    get(conditions: { userId?: string, groupId?: string }) {
        const whereConditions: any = {};
        if (conditions.userId) {
            whereConditions.userId = conditions.userId;
        }
        if (conditions.groupId) {
            whereConditions.groupId = conditions.groupId;
        }
        const queryString = knexBuilder
            .select('*')
            .from(USER_GROUPS_TABLE_NAME)
            .where(whereConditions)
            .toString();

        return this.db.read.query(queryString)
            .then((response) => response.rows);
    }

    getById(id: string) {
        const queryString = knexBuilder.select()
            .from(USER_GROUPS_TABLE_NAME)
            .where({ id })
            .toString();

        return this.db.read.query(queryString).then((response) => response.rows[0]);
    }

    create(params: ICreateUserGroupParams) {
        const modifiedParams: any = {
            ...params,
            role: params.role || 'member',
            status: params.status || 'pending',
        };
        const queryString = knexBuilder.insert(modifiedParams)
            .into(USER_GROUPS_TABLE_NAME)
            .returning('*')
            .toString();

        return this.db.write.query(queryString).then((response) => response.rows);
    }

    update(id: string, params: any) {
        const queryString = knexBuilder.where({ id })
            .update(params)
            .into(USER_GROUPS_TABLE_NAME)
            .returning('*')
            .toString();

        return this.db.write.query(queryString).then((updateResponse) => updateResponse.rows);
    }

    delete(id: string, userId: string) {
        const queryString = knexBuilder.where({ id, userId })
            .delete()
            .into(USER_GROUPS_TABLE_NAME)
            .returning('*')
            .toString();

        return this.db.write.query(queryString).then((updateResponse) => updateResponse.rows);
    }
}