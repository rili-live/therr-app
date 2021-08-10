import KnexBuilder, { Knex } from 'knex';
import normalizeEmail from 'normalize-email';
import { IConnection } from './connection';

const knexBuilder: Knex = KnexBuilder({ client: 'pg' });

export const SUBSCRIBERS_TABLE_NAME = 'main.emailMarketingSubscribers';

export interface ICreateSubscriberParams {
    email: string;
}

export default class SubscribersStore {
    db: IConnection;

    constructor(dbConnection) {
        this.db = dbConnection;
    }

    findSubscriber(params: ICreateSubscriberParams) {
        const sanitizedParams = {
            ...params,
            email: normalizeEmail(params.email),
        };
        const queryString = knexBuilder.select()
            .from(SUBSCRIBERS_TABLE_NAME)
            .where(sanitizedParams)
            .returning('*')
            .toString();

        return this.db.read.query(queryString).then((response) => response.rows);
    }

    createSubscriber(params: ICreateSubscriberParams) {
        const sanitizedParams = {
            ...params,
            email: normalizeEmail(params.email),
        };
        const queryString = knexBuilder.insert(sanitizedParams)
            .into(SUBSCRIBERS_TABLE_NAME)
            .returning('*')
            .toString();

        return this.db.write.query(queryString).then((response) => response.rows);
    }
}
