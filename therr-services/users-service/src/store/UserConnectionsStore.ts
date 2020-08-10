import Knex from 'knex';
import formatSQLJoinAsJSON from 'therr-js-utilities/format-sql-join-as-json';
import { getDbCountQueryString } from 'therr-js-utilities/db';
import connection, { IConnection } from './connection';
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

class Store {
    db: IConnection;

    constructor(dbConnection) {
        this.db = dbConnection;
    }

    // TODO: Verify that the count is correct after adding custom search method
    countRecords(params) {
        const queryString = getDbCountQueryString({
            queryBuilder: knex,
            tableName: USER_CONNECTIONS_TABLE_NAME,
            params,
            defaultConditions: {
                isConnectionBroken: false,
                requestStatus: 'complete',
            },
        });

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

        return this.db.read.query(queryString).then((response) => formatSQLJoinAsJSON(response.rows, ['users']));
    }

    // TODO: RSERV:25 - Make this dynamic to accept multiple queries
    searchUserConnections(conditions: any = {}, returning, shouldCheckReverse?: string) {
        const offset = conditions.pagination.itemsPerPage * (conditions.pagination.pageNumber - 1);
        const limit = conditions.pagination.itemsPerPage;
        let queryString: any = knex
            .select([
                `${USER_CONNECTIONS_TABLE_NAME}.id`,
                `${USER_CONNECTIONS_TABLE_NAME}.requestingUserId`,
                `${USER_CONNECTIONS_TABLE_NAME}.acceptingUserId`,
                `${USER_CONNECTIONS_TABLE_NAME}.interactionCount`,
                `${USER_CONNECTIONS_TABLE_NAME}.requestStatus`,
                `${USER_CONNECTIONS_TABLE_NAME}.isConnectionBroken`,
                `${USER_CONNECTIONS_TABLE_NAME}.createdAt`,
                `${USER_CONNECTIONS_TABLE_NAME}.updatedAt`,
            ] || returning)
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
            const query = operator === 'like' ? `%${conditions.query}%` : conditions.query;
            if (shouldCheckReverse === 'true') {
                queryString = queryString.andWhere('requestingUserId', operator, query)
                    .orWhere({
                        isConnectionBroken: false,
                        requestStatus: 'complete',
                    })
                    .andWhere('acceptingUserId', operator, query);
            } else {
                queryString = queryString.andWhere(conditions.filterBy, operator, query);
            }
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

        return this.db.read.query(queryString).then((response) => formatSQLJoinAsJSON(response.rows, ['users']));
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

export default new Store(connection);
