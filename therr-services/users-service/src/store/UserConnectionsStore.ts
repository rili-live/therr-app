import Knex from 'knex';
import formatSQLJoinAsJSON from 'therr-js-utilities/format-sql-join-as-json';
import { IConnection } from './connection';
import { USERS_TABLE_NAME } from './UsersStore';

const knex: Knex = Knex({ client: 'pg' });

export const USER_CONNECTIONS_TABLE_NAME = 'main.userConnections';

export interface ICreateUserConnectionParams {
    requestingUserId: number;
    acceptingUserId: number;
    interactionCount?: number;
    isConnectionBroken?: boolean;
    requestStatus: 'pending';
}

export interface IUpdateUserConnectionConditions {
    requestingUserId: number;
    acceptingUserId: number;
}

export interface IUpdateUserConnectionParams {
    interactionCount?: number;
    isConnectionBroken?: boolean;
    requestStatus?: 'pending' | 'complete' | 'denied';
}

export default class UserConnectionsStore {
    db: IConnection;

    constructor(dbConnection) {
        this.db = dbConnection;
    }

    // TODO: This value is incorrect
    // Need to make the search query a transaction and include the count there
    countRecords(params, shouldCheckReverse?: string) {
        let queryString: any = knex.count('*')
            .from(USER_CONNECTIONS_TABLE_NAME)
            .innerJoin(USERS_TABLE_NAME, function () {
                this.on(function () {
                    this.on(`${USERS_TABLE_NAME}.id`, '=', `${USER_CONNECTIONS_TABLE_NAME}.requestingUserId`);
                    this.orOn(`${USERS_TABLE_NAME}.id`, '=', `${USER_CONNECTIONS_TABLE_NAME}.acceptingUserId`);
                });
            })
            .where({
                isConnectionBroken: false,
                requestStatus: 'complete',
            });

        if (params.filterBy && params.query) {
            const operator = params.filterOperator || '=';
            const query = operator === 'ilike' ? `%${params.query}%` : params.query;
            queryString = queryString.andWhere((builder) => {
                builder.where('requestingUserId', operator, query);
                if (shouldCheckReverse === 'true') {
                    builder.orWhere('acceptingUserId', operator, query);
                }
            });
        }

        queryString = queryString.toString();

        return this.db.read.query(queryString).then((response) => response.rows);
    }

    getUserConnections(conditions: any = {}, shouldCheckReverse?: boolean) {
        let queryString;
        if (shouldCheckReverse) {
            queryString = knex.select('*')
                .from(USER_CONNECTIONS_TABLE_NAME)
                .where({
                    requestingUserId: conditions.requestingUserId,
                    acceptingUserId: conditions.acceptingUserId,
                })
                .orWhere({
                    requestingUserId: conditions.acceptingUserId,
                    acceptingUserId: conditions.requestingUserId,
                })
                .toString();
        } else {
            queryString = knex.select('*')
                .from(USER_CONNECTIONS_TABLE_NAME)
                .where({
                    ...conditions,
                })
                .toString();
        }

        return this.db.read.query(queryString).then((response) => response.rows);
    }

    getExpandedUserConnections(conditions: any = {}) {
        const queryString = knex.select([
            `${USER_CONNECTIONS_TABLE_NAME}.id`,
            `${USER_CONNECTIONS_TABLE_NAME}.requestingUserId`,
            `${USER_CONNECTIONS_TABLE_NAME}.acceptingUserId`,
            `${USER_CONNECTIONS_TABLE_NAME}.interactionCount`,
            `${USER_CONNECTIONS_TABLE_NAME}.requestStatus`,
            `${USER_CONNECTIONS_TABLE_NAME}.isConnectionBroken`,
            `${USER_CONNECTIONS_TABLE_NAME}.createdAt`,
            `${USER_CONNECTIONS_TABLE_NAME}.updatedAt`,
        ])
            .from(USER_CONNECTIONS_TABLE_NAME)
            .innerJoin(USERS_TABLE_NAME, function () {
                this.on(function () {
                    this.on(`${USERS_TABLE_NAME}.id`, '=', `${USER_CONNECTIONS_TABLE_NAME}.requestingUserId`);
                    this.orOn(`${USERS_TABLE_NAME}.id`, '=', `${USER_CONNECTIONS_TABLE_NAME}.acceptingUserId`);
                });
            })
            .columns([
                `${USERS_TABLE_NAME}.id as users[].id`,
                `${USERS_TABLE_NAME}.userName as users[].userName`,
                `${USERS_TABLE_NAME}.firstName as users[].firstName`,
                `${USERS_TABLE_NAME}.lastName as users[].lastName`,
            ])
            .where({
                ...conditions,
            })
            .toString();

        return this.db.read.query(queryString).then((response) => formatSQLJoinAsJSON(response.rows, [{ propKey: 'users', propId: 'id' }]));
    }

    // TODO: RSERV:25 - Make this dynamic to accept multiple queries
    searchUserConnections(conditions: any = {}, returning, shouldCheckReverse?: string) {
        const offset = conditions.pagination.itemsPerPage * (conditions.pagination.pageNumber - 1);
        const limit = conditions.pagination.itemsPerPage;
        let queryString: any = knex
            .select((returning && returning.length) ? returning : [
                `${USER_CONNECTIONS_TABLE_NAME}.id`,
                `${USER_CONNECTIONS_TABLE_NAME}.requestingUserId`,
                `${USER_CONNECTIONS_TABLE_NAME}.acceptingUserId`,
                `${USER_CONNECTIONS_TABLE_NAME}.interactionCount`,
                `${USER_CONNECTIONS_TABLE_NAME}.requestStatus`,
                `${USER_CONNECTIONS_TABLE_NAME}.isConnectionBroken`,
                `${USER_CONNECTIONS_TABLE_NAME}.createdAt`,
                `${USER_CONNECTIONS_TABLE_NAME}.updatedAt`,
            ])
            .from(USER_CONNECTIONS_TABLE_NAME)
            .innerJoin(USERS_TABLE_NAME, function () {
                this.on(function () {
                    this.on(`${USERS_TABLE_NAME}.id`, '=', `${USER_CONNECTIONS_TABLE_NAME}.requestingUserId`);
                    this.orOn(`${USERS_TABLE_NAME}.id`, '=', `${USER_CONNECTIONS_TABLE_NAME}.acceptingUserId`);
                });
            })
            .columns([
                `${USERS_TABLE_NAME}.id as users[].id`,
                `${USERS_TABLE_NAME}.userName as users[].userName`,
                `${USERS_TABLE_NAME}.firstName as users[].firstName`,
                `${USERS_TABLE_NAME}.lastName as users[].lastName`,
            ])
            .where({
                isConnectionBroken: false,
                requestStatus: 'complete',
            });

        if (conditions.filterBy && conditions.query) {
            const operator = conditions.filterOperator || '=';
            const query = operator === 'ilike' ? `%${conditions.query}%` : conditions.query;
            queryString = queryString.andWhere((builder) => {
                builder.where('requestingUserId', operator, query);
                if (shouldCheckReverse === 'true') {
                    builder.orWhere('acceptingUserId', operator, query);
                }
            });
        }

        // if (groupBy) {
        //     queryString = queryString.groupBy(groupBy);
        // }

        if (conditions.orderBy) {
            queryString = queryString.orderBy(conditions.orderBy, conditions.order);
        }

        queryString = queryString
            .limit(limit)
            .offset(offset)
            .toString();

        return this.db.read.query(queryString).then((response) => formatSQLJoinAsJSON(response.rows, [{ propKey: 'users', propId: 'id' }]));
    }

    createUserConnection(params: ICreateUserConnectionParams) {
        const queryString = knex.insert(params)
            .into(USER_CONNECTIONS_TABLE_NAME)
            .returning('*')
            .toString();

        return this.db.write.query(queryString).then((response) => response.rows);
    }

    updateUserConnection(conditions: IUpdateUserConnectionConditions, params: IUpdateUserConnectionParams) {
        const queryString = knex.update({
            ...params,
            updatedAt: new Date(),
        })
            .into(USER_CONNECTIONS_TABLE_NAME)
            .where(conditions)
            .returning('*')
            .toString();

        return this.db.write.query(queryString).then((response) => response.rows);
    }
}
