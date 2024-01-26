import KnexBuilder, { Knex } from 'knex';
import { Notifications, PushNotifications } from 'therr-js-utilities/constants';
import { getDbCountQueryString } from 'therr-js-utilities/db';
import formatSQLJoinAsJSON from 'therr-js-utilities/format-sql-join-as-json';
import { IConnection } from './connection';
import { USER_CONNECTIONS_TABLE_NAME } from './tableNames';

const knexBuilder: Knex = KnexBuilder({ client: 'pg' });

export const NOTIFICATIONS_TABLE_NAME = 'main.notifications';

export interface ICreateNotificationParams {
    userId: string;
    type: any;
    // type: Notifications.Types;
    associationId?: string;
    isUnread: boolean;
    messageLocaleKey?: any;
    // messageLocaleKey?: Notifications.MessageKeys;
    messageParams?: any;
}

export interface IUpdateNotificationConditions {
    id: string;
}

export interface IUpdateNotificationParams {
    type?: string;
    associationId?: string;
    isUnread?: boolean;
    messageLocaleKey?: string;
    messageParams?: any;
}

export default class NotificationsStore {
    db: IConnection;

    constructor(dbConnection) {
        this.db = dbConnection;
    }

    // TODO: This value is incorrect
    // Need to make the search query a transaction and include the count there
    countRecords(params) {
        const queryString = getDbCountQueryString({
            queryBuilder: knexBuilder,
            tableName: NOTIFICATIONS_TABLE_NAME,
            params,
            defaultConditions: {},
        });

        return this.db.read.query(queryString).then((response) => response.rows);
    }

    getNotifications(conditions = {}) {
        const queryString = knexBuilder.select('*')
            .from(NOTIFICATIONS_TABLE_NAME)
            .where(conditions)
            .toString();
        return this.db.read.query(queryString).then((response) => response.rows);
    }

    // TODO: RSERV:25 - Make this dynamic to support various associationIds
    // WARNING: This could become a potential bottleneck
    searchNotifications(userId, conditions: any = {}) {
        const offset = conditions.pagination.itemsPerPage * (conditions.pagination.pageNumber - 1);
        const limit = conditions.pagination.itemsPerPage;
        let queryString: any = knexBuilder
            .select([
                `${NOTIFICATIONS_TABLE_NAME}.id`,
                `${NOTIFICATIONS_TABLE_NAME}.userId`,
                `${NOTIFICATIONS_TABLE_NAME}.type`,
                `${NOTIFICATIONS_TABLE_NAME}.associationId`,
                `${NOTIFICATIONS_TABLE_NAME}.isUnread`,
                `${NOTIFICATIONS_TABLE_NAME}.messageLocaleKey`,
                `${NOTIFICATIONS_TABLE_NAME}.messageParams`,
                `${NOTIFICATIONS_TABLE_NAME}.createdAt`,
                `${NOTIFICATIONS_TABLE_NAME}.updatedAt`,
            ])
            .from(NOTIFICATIONS_TABLE_NAME)
            .leftJoin(USER_CONNECTIONS_TABLE_NAME, function () {
                this.on(knexBuilder.raw(`"main"."notifications"."associationId" = "main"."userConnections".id AND (${NOTIFICATIONS_TABLE_NAME}.type = '${Notifications.Types.CONNECTION_REQUEST_ACCEPTED}' OR ${NOTIFICATIONS_TABLE_NAME}.type = '${Notifications.Types.CONNECTION_REQUEST_RECEIVED}')`)); // eslint-disable-line max-len
            })
            .columns([
                `${USER_CONNECTIONS_TABLE_NAME}.requestingUserId as userConnection.requestingUserId`,
                `${USER_CONNECTIONS_TABLE_NAME}.acceptingUserId as userConnection.acceptingUserId`,
                `${USER_CONNECTIONS_TABLE_NAME}.requestStatus as userConnection.requestStatus`,
                `${USER_CONNECTIONS_TABLE_NAME}.updatedAt as userConnection.updatedAt`,
            ])
            .where(`${NOTIFICATIONS_TABLE_NAME}.userId`, '=', userId);

        // if (conditions.filterBy && conditions.query) {
        //     const operator = conditions.filterOperator || '=';
        //     const query = operator === 'ilike' ? `%${conditions.query}%` : conditions.query;
        //     queryString = queryString.andWhere(conditions.filterBy, operator, query);
        // }

        queryString = queryString.orderBy(`${NOTIFICATIONS_TABLE_NAME}.updatedAt`, conditions.order || 'asc');

        queryString = queryString
            .limit(limit)
            .offset(offset)
            .toString();

        return this.db.read.query(queryString).then((response) => {
            const configuredResponse = formatSQLJoinAsJSON(response.rows, []);
            // delete configuredResponse.requestingUserId;
            // delete configuredResponse.acceptingUserId;
            // delete configuredResponse.requestStatus;
            return configuredResponse;
        });
    }

    createNotification(params: ICreateNotificationParams) {
        const modifiedParams = {
            ...params,
            messageParams: JSON.stringify(params.messageParams),
        };
        const queryString = knexBuilder.insert(modifiedParams)
            .into(NOTIFICATIONS_TABLE_NAME)
            .returning('*')
            .toString();

        return this.db.write.query(queryString).then((response) => response.rows);
    }

    updateNotification(conditions: IUpdateNotificationConditions, params: IUpdateNotificationParams) {
        const queryString = knexBuilder.update({
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
