import KnexBuilder, { Knex } from 'knex';
import { IConnection } from './connection';

const knexBuilder: Knex = KnexBuilder({ client: 'pg' });

export const CONFIG_TABLE_NAME = 'main.config';

export default class ConfigStore {
    db: IConnection;

    constructor(dbConnection) {
        this.db = dbConnection;
    }

    get(key: string) {
        const queryString = knexBuilder.select('*')
            .from(CONFIG_TABLE_NAME)
            .where({
                key,
            })
            .toString();
        return this.db.read.query(queryString).then((response) => response.rows);
    }
}
