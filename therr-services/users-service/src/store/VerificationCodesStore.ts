import Knex from 'knex';
import { IConnection } from './connection';

const knex: Knex = Knex({ client: 'pg' });

export const VERIFICATION_CODES_TABLE_NAME = 'main.verificationCodes';

export default class VerificationCodesStore {
    db: IConnection;

    constructor(dbConnection) {
        this.db = dbConnection;
    }

    getCode(conditions = {}) {
        const queryString = knex.select('*')
            .from(VERIFICATION_CODES_TABLE_NAME)
            .where(conditions)
            .toString();
        return this.db.read.query(queryString).then((response) => response.rows);
    }

    createCode(params = {}) {
        const queryString = knex.insert(params)
            .into(VERIFICATION_CODES_TABLE_NAME)
            .toString();
        return this.db.write.query(queryString).then((response) => response.rows);
    }
}
