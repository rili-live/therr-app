import KnexBuilder, { Knex } from 'knex';
import formatSQLJoinAsJSON from 'therr-js-utilities/format-sql-join-as-json';
import { UserConnectionTypes } from 'therr-js-utilities/constants';
import { IConnection } from './connection';
import { USERS_TABLE_NAME, USER_CONNECTIONS_TABLE_NAME, USER_INTERESTS_TABLE_NAME } from './tableNames';

const knexBuilder: Knex = KnexBuilder({ client: 'pg' });

export interface ICreateUserConnectionParams {
    requestingUserId: string;
    acceptingUserId: string;
    interactionCount?: number;
    isConnectionBroken?: boolean;
    requestStatus: UserConnectionTypes; // auto-complete should only be available internally
}

export interface IUpdateUserConnectionConditions {
    requestingUserId: string;
    acceptingUserId: string;
    requestStatus?: UserConnectionTypes;
}

export interface IUpdateUserConnectionParams {
    interactionCount?: number;
    isConnectionBroken?: boolean;
    requestStatus?: UserConnectionTypes;
}

export default class UserConnectionsStore {
    db: IConnection;

    constructor(dbConnection) {
        this.db = dbConnection;
    }

    // TODO: This value is incorrect
    // Need to make the search query a transaction and include the count there
    countRecords(params, shouldCheckReverse?: string) {
        let queryString: any = knexBuilder.count('*')
            .from(USER_CONNECTIONS_TABLE_NAME)
            .innerJoin(USERS_TABLE_NAME, function () {
                this.on(function () {
                    this.on(`${USERS_TABLE_NAME}.id`, '=', `${USER_CONNECTIONS_TABLE_NAME}.requestingUserId`);
                    this.orOn(`${USERS_TABLE_NAME}.id`, '=', `${USER_CONNECTIONS_TABLE_NAME}.acceptingUserId`);
                });
            })
            .where({
                isConnectionBroken: false,
                requestStatus: UserConnectionTypes.COMPLETE,
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

    countUserConnections(userId, conditions = {}) {
        const queryString = knexBuilder.count('*')
            .from(USER_CONNECTIONS_TABLE_NAME)
            .where({
                requestingUserId: userId,
                ...conditions,
            })
            .orWhere({
                acceptingUserId: userId,
            })
            .toString();

        return this.db.read.query(queryString).then((response) => response.rows);
    }

    // eslint-disable-next-line default-param-last
    getUserConnections(conditions: any = {}, shouldCheckReverse?: boolean) {
        let queryString;
        if (shouldCheckReverse) {
            queryString = knexBuilder.select('*')
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
            queryString = knexBuilder.select('*')
                .from(USER_CONNECTIONS_TABLE_NAME)
                .where({
                    ...conditions,
                })
                .toString();
        }

        return this.db.read.query(queryString).then((response) => response.rows);
    }

    getExpandedUserConnections(conditions: any = {}) {
        const queryString = knexBuilder.select([
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
    // eslint-disable-next-line default-param-last
    searchUserConnections(conditions: any = {}, returning?: any, shouldCheckReverse?: string) {
        const offset = conditions.pagination.itemsPerPage * (conditions.pagination.pageNumber - 1);
        const limit = conditions.pagination.itemsPerPage;
        let queryString = knexBuilder
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
                `${USERS_TABLE_NAME}.media as users[].media`,
            ])
            .where({
                isConnectionBroken: false,
                requestStatus: UserConnectionTypes.COMPLETE,
            });

        if (conditions.userId) {
            queryString = queryString.where({
                [`${USER_CONNECTIONS_TABLE_NAME}.requestingUserId`]: conditions.userId,
            }).orWhere({
                [`${USER_CONNECTIONS_TABLE_NAME}.acceptingUserId`]: conditions.userId,
            });
        }

        // TODO: Compare query performance and consider using `findUserConnections` method instead
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
            .offset(offset);

        return this.db.read.query(queryString.toString())
            .then((response) => formatSQLJoinAsJSON(response.rows, [{ propKey: 'users', propId: 'id' }]));
    }

    findUserConnections(userId: string, otherUserIds: string[]) {
        const queryString = knexBuilder
            .select(['acceptingUserId', 'requestingUserId'])
            .from(USER_CONNECTIONS_TABLE_NAME)
            .where((builder) => {
                builder.where({ requestingUserId: userId }).and.whereIn('acceptingUserId', otherUserIds);
            })
            .orWhere((builder) => {
                builder.where({ acceptingUserId: userId }).and.whereIn('requestingUserId', otherUserIds);
            });

        return this.db.read.query(queryString.toString()).then((response) => response.rows);
    }

    createUserConnection(params: ICreateUserConnectionParams) {
        const queryString = knexBuilder.insert(params)
            .into(USER_CONNECTIONS_TABLE_NAME)
            .returning('*')
            .toString();

        return this.db.write.query(queryString).then((response) => response.rows);
    }

    createUserConnections(userId: string, otherUserIds: string[]) {
        const newConnections = otherUserIds.map((otherUserId) => ({
            requestingUserId: userId,
            acceptingUserId: otherUserId,
            requestStatus: UserConnectionTypes.PENDING,
        }));
        const queryString = knexBuilder.insert(newConnections)
            .into(USER_CONNECTIONS_TABLE_NAME)
            .returning(['id', 'acceptingUserId', 'requestingUserId'])
            .toString();

        return this.db.write.query(queryString).then((response) => response.rows);
    }

    createIfNotExist(connections: ICreateUserConnectionParams[]) {
        const queryString = knexBuilder.insert(connections)
            .into(USER_CONNECTIONS_TABLE_NAME)
            .onConflict()
            .ignore()
            .returning('id')
            .toString();

        return this.db.write.query(queryString).then((response) => response.rows);
    }

    updateUserConnection(conditions: IUpdateUserConnectionConditions, params: IUpdateUserConnectionParams) {
        const queryString = knexBuilder.update({
            ...params,
            updatedAt: new Date(),
        })
            .into(USER_CONNECTIONS_TABLE_NAME)
            .where(conditions)
            .returning('*')
            .toString();

        return this.db.write.query(queryString).then((response) => response.rows);
    }

    incrementUserConnection(userId1, userId2, incrBy = 1) {
        const queryString = knexBuilder.increment('interactionCount', incrBy)
            .into(USER_CONNECTIONS_TABLE_NAME)
            .where({
                acceptingUserId: userId1,
                requestingUserId: userId2,
            })
            .orWhere({
                acceptingUserId: userId2,
                requestingUserId: userId1,
            })
            .returning('*')
            .toString();

        return this.db.write.query(queryString).then((response) => response.rows);
    }
}
