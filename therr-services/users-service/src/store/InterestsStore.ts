import KnexBuilder, { Knex } from 'knex';
import formatSQLJoinAsJSON from 'therr-js-utilities/format-sql-join-as-json';
import { IConnection } from './connection';
import { INTERESTS_TABLE_NAME } from './tableNames';

const knexBuilder: Knex = KnexBuilder({ client: 'pg' });
export interface ICreateInterestParams {
    tag: string;
    category: string;
    displayName: string;
    emoji: string;
    iconGroup: string;
    iconId: string;
    iconColor: string;
}

export default class InterestsStore {
    db: IConnection;

    constructor(dbConnection) {
        this.db = dbConnection;
    }

    get(conditions: any, returning: string[] | string = '*') {
        const queryString = knexBuilder
            .select(returning)
            .from(INTERESTS_TABLE_NAME)
            .where(conditions);

        return this.db.read.query(queryString.toString())
            .then((response) => response.rows);
    }

    getById(id: string) {
        return this.get({ id });
    }

    getByTag(tag: string) {
        return this.get({ tag });
    }
}
