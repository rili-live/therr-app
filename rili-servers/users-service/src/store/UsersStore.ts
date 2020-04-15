import Knex from 'knex';
import connection, { IConnection } from './connection';

const knex: Knex = Knex({ client: 'pg' });

export const USERS_TABLE_NAME = 'main.users';

export interface ICreateUserParams {
    email: string;
    firstName: string;
    lastName: string;
    password: string;
    phoneNumber: string;
    userName: string;
}

interface IFindUserArgs {
    id?: number;
    email?: string;
    userName?: string;
    phoneNumber?: string;
}

class Store {
    db: IConnection;

    constructor(dbConnection) {
        this.db = dbConnection;
    }

    getUsers(conditions = {}, orConditions = {}) {
        const queryString = knex.select('*')
            .from(USERS_TABLE_NAME)
            .orderBy('id')
            .where(conditions)
            .orWhere(orConditions)
            .toString();
        return this.db.read.query(queryString).then((response) => response.rows);
    }

    findUser({
        id,
        email,
        userName,
        phoneNumber,
    }: IFindUserArgs) {
        let queryString: any = knex.select('*').from('main.users')
            .where(function () {
                return id ? this.where({ id }) : this;
            });
        if (email) {
            queryString = queryString.orWhere({ email });
        }
        if (userName) {
            queryString = queryString.orWhere({ userName });
        }
        if (phoneNumber) {
            queryString = queryString.orWhere({ phoneNumber });
        }

        queryString = queryString.toString();
        return this.db.read.query(queryString).then((response) => response.rows);
    }

    createUser(params: ICreateUserParams) {
        const sanitizedParams = {
            ...params,
            userName: params.userName.toLowerCase(),
        };
        const queryString = knex.insert(params)
            .into(USERS_TABLE_NAME)
            .returning(['email', 'id', 'userName', 'accessLevels'])
            .toString();

        return this.db.write.query(queryString).then((response) => response.rows);
    }

    updateUser(params, conditions = {}) {
        const queryString = knex.update(params)
            .into(USERS_TABLE_NAME)
            .where(conditions)
            .returning('*')
            .toString();

        return this.db.write.query(queryString).then((response) => response.rows);
    }

    deleteUsers(conditions) {
        const queryString = knex.delete()
            .from(USERS_TABLE_NAME)
            .where(conditions)
            .toString();

        return this.db.write.query(queryString).then((response) => response.rows);
    }
}

export default new Store(connection);
