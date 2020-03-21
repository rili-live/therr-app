import Knex from 'knex';
import { countDbRecords, searchDbRecords } from 'rili-public-library/utilities/db.js';
import connection, { IConnection } from './connection';

const knex: Knex = Knex({ client: 'pg' });

const USER_CONNECTIONS_TABLE_NAME = 'main.userConnections';

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

    countRecords(params) {
        return countDbRecords({
            queryBuilder: knex,
            execQuery: this.db.write.query,
            tableName: USER_CONNECTIONS_TABLE_NAME,
            params,
        }).then((response) => response.rows);
    }

    getUserConnections(conditions = {}) {
        const queryString = knex.select('*')
            .from(USER_CONNECTIONS_TABLE_NAME)
            .where(conditions)
            .toString();
        return this.db.read.query(queryString).then((response) => response.rows);
    }

    searchUserConnections(conditions = {}, returning) {
        return searchDbRecords({
            queryBuilder: knex,
            execQuery: this.db.read.query,
            tableName: USER_CONNECTIONS_TABLE_NAME,
            conditions,
            returning,
        }).then((response) => response.rows);
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
