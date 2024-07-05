import KnexBuilder, { Knex } from 'knex';
import formatSQLJoinAsJSON from 'therr-js-utilities/format-sql-join-as-json';
import { GroupMemberRoles, GroupRequestStatuses } from 'therr-js-utilities/constants';
import { IConnection } from './connection';
import { USER_GROUPS_TABLE_NAME } from './tableNames';

const knexBuilder: Knex = KnexBuilder({ client: 'pg' });
export interface ICreateUserGroupParams {
    userId: string;
    groupId: string;
    role?: string;
    status?: string;
    shouldMuteNotifs?: boolean;
    shouldShareLocation?: boolean;
    engagementCount?: number;
}

export default class UserGroupsStore {
    db: IConnection;

    constructor(dbConnection) {
        this.db = dbConnection;
    }

    get(conditions: { userId?: string, groupId?: string, status?: string }, overrides: any = {}) {
        const whereConditions: any = {};
        if (conditions.userId) {
            whereConditions.userId = conditions.userId;
        }
        if (conditions.groupId) {
            whereConditions.groupId = conditions.groupId;
        }

        let queryString = knexBuilder
            .select(overrides?.returning === 'simple' ? ['userId'] : '*')
            .from(USER_GROUPS_TABLE_NAME)
            .where(whereConditions);

        if (conditions.status) {
            whereConditions.status = conditions.status;
            const statuses = [conditions.status];
            if (overrides?.shouldIncludePending) {
                statuses.push(GroupRequestStatuses.PENDING);
            }
            queryString = queryString.whereIn('status', statuses);
        }

        if (overrides?.limit) {
            queryString = queryString.limit(overrides?.limit);
        }

        return this.db.read.query(queryString.toString())
            .then((response) => response.rows);
    }

    getById(id: string) {
        const queryString = knexBuilder.select()
            .from(USER_GROUPS_TABLE_NAME)
            .where({ id })
            .toString();

        return this.db.read.query(queryString).then((response) => response.rows[0]);
    }

    create(paramsList: ICreateUserGroupParams[]) {
        const modifiedParamList = paramsList.map((params) => ({
            ...params,
            role: params.role || GroupMemberRoles.MEMBER,
            status: params.status || GroupRequestStatuses.PENDING,
        }));
        const queryString = knexBuilder.insert(modifiedParamList)
            .into(USER_GROUPS_TABLE_NAME)
            .onConflict(['userId', 'groupId'])
            .merge()
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
        const queryString = knexBuilder.where({ groupId: id, userId })
            .delete()
            .into(USER_GROUPS_TABLE_NAME)
            .returning('*')
            .toString();

        return this.db.write.query(queryString).then((updateResponse) => updateResponse.rows);
    }
}
