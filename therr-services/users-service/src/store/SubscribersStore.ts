import KnexBuilder, { Knex } from 'knex';
import normalizeEmail from 'normalize-email';
import { IConnection } from './connection';

const knexBuilder: Knex = KnexBuilder({ client: 'pg' });

export const SUBSCRIBERS_TABLE_NAME = 'main.emailMarketingSubscribers';

export interface IFindSubscriberParams {
    email: string;
}

export interface ICreateSubscriberParams {
    email: string;
    /**
     * Which app's marketing surface this address came from. Provenance only — the table is
     * identity-shared (one row per address across every app, enforced by the UNIQUE on
     * `email`), so this must never be used as a read predicate. See the migration comment in
     * 20260914000001_main.emailMarketingSubscribers.iosWaitlist.js.
     */
    brandVariation?: string;
    isSubscribedToIosWaitlist?: boolean;
}

export default class SubscribersStore {
    db: IConnection;

    constructor(dbConnection) {
        this.db = dbConnection;
    }

    findSubscriber(params: IFindSubscriberParams) {
        const sanitizedParams = {
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

    /**
     * Used to add the iOS waitlist flag to an address that already subscribed to general
     * updates. Without it that visitor gets "you're already subscribed" and their interest in
     * iOS is never recorded — which is the one number the waitlist exists to produce.
     */
    updateSubscriber(params: Partial<ICreateSubscriberParams>, conditions: IFindSubscriberParams) {
        const queryString = knexBuilder.update({
            ...params,
            // ISO-8601 rather than a Date: knex's `.toString()` renders a Date into the Node
            // process's local timezone with no offset, and Postgres then parses that naive
            // literal in the DB session's timezone — shifting the value on any non-UTC host.
            // Same fix as `lastLoginAt` in UsersStore.
            updatedAt: new Date().toISOString(),
        })
            .into(SUBSCRIBERS_TABLE_NAME)
            .where({ email: normalizeEmail(conditions.email) })
            .returning('*')
            .toString();

        return this.db.write.query(queryString).then((response) => response.rows);
    }
}
