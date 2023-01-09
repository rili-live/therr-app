import KnexBuilder, { Knex } from 'knex';
import { IConnection } from './connection';

const knexBuilder: Knex = KnexBuilder({ client: 'pg' });

export const BLACKLISTED_EMAILS_TABLE_NAME = 'main.blacklistedEmails';

export default class BlacklistedEmailsStore {
    db: IConnection;

    constructor(dbConnection) {
        this.db = dbConnection;
    }

    get(conditions = {}) {
        const queryString = knexBuilder.select('*')
            .from(BLACKLISTED_EMAILS_TABLE_NAME)
            .where(conditions)
            .toString();
        return this.db.read.query(queryString).then((response) => response.rows);
    }

    create(params = {}) {
        const queryString = knexBuilder.insert(params)
            .into(BLACKLISTED_EMAILS_TABLE_NAME)
            .toString();
        return this.db.write.query(queryString).then((response) => response.rows);
    }
}
