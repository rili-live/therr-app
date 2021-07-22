import KnexBuilder, { Knex } from 'knex';
import { IConnection } from './connection';

const knexBuilder: Knex = KnexBuilder({ client: 'pg' });

export const VERIFICATION_CODES_TABLE_NAME = 'main.verificationCodes';

export default class VerificationCodesStore {
    db: IConnection;

    constructor(dbConnection) {
        this.db = dbConnection;
    }

    getCode(conditions = {}) {
        const queryString = knexBuilder.select('*')
            .from(VERIFICATION_CODES_TABLE_NAME)
            .where(conditions)
            .toString();
        return this.db.read.query(queryString).then((response) => response.rows);
    }

    createCode(params = {}) {
        const queryString = knexBuilder.insert(params)
            .into(VERIFICATION_CODES_TABLE_NAME)
            .toString();
        return this.db.write.query(queryString).then((response) => response.rows);
    }

    updateCode(params = {}, conditions = {}) {
        const queryString = knexBuilder.update({
            ...params,
            updatedAt: new Date(),
        })
            .into(VERIFICATION_CODES_TABLE_NAME)
            .where(conditions)
            .toString();
        return this.db.write.query(queryString).then((response) => response.rows);
    }

    deleteCode(conditions = {}) {
        const queryString = knexBuilder.delete()
            .from(VERIFICATION_CODES_TABLE_NAME)
            .where(conditions)
            .toString();
        return this.db.write.query(queryString).then((response) => response.rows);
    }
}
