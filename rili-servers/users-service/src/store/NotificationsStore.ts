import Knex from 'knex';
import { getDbCountQueryString, getDbQueryString } from 'rili-public-library/utilities/db.js';
import connection, { IConnection } from './connection';

const knex: Knex = Knex({ client: 'pg' });

const NOTIFICATIONS_TABLE_NAME = 'main.notifications';

export enum NotificationTypes {
    CONNECTION_REQUEST_RECEIVED = 'CONNECTION_REQUEST_RECEIVED',
}

export enum NotificationMessages {
    CONNECTION_REQUEST_RECEIVED = 'You have received a new connection request from {{firstName}} {{lastName}}',
}

export interface ICreateNotificationParams {
    userId: number;
    type: NotificationTypes;
    associationId?: number;
    isUnread: boolean;
    message?: NotificationMessages;
    messageParams?: any;
}

export interface IUpdateNotificationConditions {
    id: number;
}

export interface IUpdateNotificationParams {
    type?: string;
    associationId?: number;
    isUnread?: boolean;
    message?: string;
    messageParams?: any;
}

class Store {
    db: IConnection;

    constructor(dbConnection) {
        this.db = dbConnection;
    }

    countRecords(params) {
        const queryString = getDbCountQueryString({
            queryBuilder: knex,
            tableName: NOTIFICATIONS_TABLE_NAME,
            params,
            defaultConditions: {},
        });

        return this.db.read.query(queryString).then((response) => response.rows);
    }

    getNotifications(conditions = {}) {
        const queryString = knex.select('*')
            .from(NOTIFICATIONS_TABLE_NAME)
            .where(conditions)
            .toString();
        return this.db.read.query(queryString).then((response) => response.rows);
    }

    searchNotifications(conditions = {}, returning) {
        const queryString = getDbQueryString({
            queryBuilder: knex,
            tableName: NOTIFICATIONS_TABLE_NAME,
            conditions,
            defaultConditions: {},
            orderBy: 'updatedAt',
            returning,
        });

        return this.db.read.query(queryString).then((response) => response.rows);
    }

    createNotification(params: ICreateNotificationParams) {
        const modifiedParams = {
            ...params,
            messageParams: JSON.stringify(params.messageParams),
        };
        const queryString = knex.insert(modifiedParams)
            .into(NOTIFICATIONS_TABLE_NAME)
            .returning('*')
            .toString();

        return this.db.write.query(queryString).then((response) => response.rows);
    }

    updateNotification(conditions: IUpdateNotificationConditions, params: IUpdateNotificationParams) {
        const queryString = knex.update({
            ...params,
            updatedAt: new Date(),
        })
            .into(NOTIFICATIONS_TABLE_NAME)
            .where(conditions)
            .returning('*')
            .toString();

        return this.db.write.query(queryString).then((response) => response.rows);
    }
}

export default new Store(connection);
