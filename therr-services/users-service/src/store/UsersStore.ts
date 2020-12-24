import Knex from 'knex';
import { IConnection } from './connection';

const knex: Knex = Knex({ client: 'pg' });

export const USERS_TABLE_NAME = 'main.users';

export interface ICreateUserParams {
    email: string;
    firstName: string;
    lastName: string;
    password: string;
    phoneNumber: string;
    userName: string;
    verificationCodes: string;
}

interface IFindUserArgs {
    id?: number;
    email?: string;
    userName?: string;
    phoneNumber?: string;
}

export default class UsersStore {
    db: IConnection;

    constructor(dbConnection) {
        this.db = dbConnection;
    }

    getUsers(conditions = {}, orConditions = {}, anotherOrConditions = {}) {
        const queryString = knex.select('*')
            .from(USERS_TABLE_NAME)
            .orderBy('id')
            .where(conditions)
            .orWhere(orConditions)
            .orWhere(anotherOrConditions)
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
        const queryString = knex.insert(sanitizedParams)
            .into(USERS_TABLE_NAME)
            .returning(['email', 'id', 'userName', 'accessLevels'])
            .toString();

        return this.db.write.query(queryString).then((response) => response.rows);
    }

    updateUser(params, conditions = {}) {
        const modifiedParams: any = {};

        if (params.accessLevels) {
            modifiedParams.accessLevels = params.accessLevels;
        }

        if (params.firstName) {
            modifiedParams.firstName = params.firstName;
        }

        if (params.lastName) {
            modifiedParams.lastName = params.lastName;
        }

        if (params.oneTimePassword) {
            modifiedParams.oneTimePassword = params.oneTimePassword;
        }

        if (params.password) {
            modifiedParams.password = params.password;
        }

        if (params.userName) {
            modifiedParams.userName = params.userName;
        }

        if (params.verificationCodes) {
            modifiedParams.verificationCodes = params.verificationCodes;
        }

        const queryString = knex.update(modifiedParams)
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
