import KnexBuilder, { Knex } from 'knex';
import { AccessLevels } from 'therr-js-utilities/constants';
import normalizeEmail from 'normalize-email';
import { IConnection } from './connection';

const knexBuilder: Knex = KnexBuilder({ client: 'pg' });

export const USERS_TABLE_NAME = 'main.users';

export interface ICreateUserParams {
    accessLevels: string | AccessLevels;
    email: string;
    firstName?: string;
    lastName?: string;
    password: string;
    phoneNumber?: string;
    userName?: string;
    verificationCodes: string;
}

interface IFindUserArgs {
    id?: number;
    email?: string;
    userName?: string;
    phoneNumber?: string;
}

interface IFindUsersArgs {
    ids?: number[];
}

export default class UsersStore {
    db: IConnection;

    constructor(dbConnection) {
        this.db = dbConnection;
    }

    // Deprecated
    getUsers(conditions = {}, orConditions = {}, anotherOrConditions = {}) {
        const queryString = knexBuilder.select(['*'])
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
    }: IFindUserArgs, returning: any = '*') {
        let queryString: any = knexBuilder.select(returning).from('main.users')
            .where(function () {
                return id ? this.where({ id }) : this;
            });
        if (email) {
            queryString = queryString.orWhere({ email: normalizeEmail(email) });
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

    findUsers({
        ids,
    }: IFindUsersArgs, returning: any = ['id', 'userName', 'firstName', 'lastName']) {
        let queryString: any = knexBuilder.select(returning).from('main.users')
            .whereIn('id', ids || []);

        queryString = queryString.toString();
        return this.db.read.query(queryString).then((response) => response.rows);
    }

    createUser(params: ICreateUserParams) {
        const sanitizedParams = {
            ...params,
            userName: params?.userName?.toLowerCase(),
            email: normalizeEmail(params.email),
        };
        const queryString = knexBuilder.insert(sanitizedParams)
            .into(USERS_TABLE_NAME)
            .returning('*')
            .toString();

        return this.db.write.query(queryString).then((response) => response.rows);
    }

    updateUser(params, conditions: any = {}) {
        const modifiedParams: any = {};
        const normalizedConditions: any = {};

        if (params.accessLevels) {
            modifiedParams.accessLevels = params.accessLevels;
        }

        // Normalize Email
        if (conditions.email) {
            normalizedConditions.email = normalizeEmail(conditions.email);
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

        if (params.loginCount) {
            modifiedParams.loginCount = params.loginCount;
        }

        if (params.deviceMobileFirebaseToken) {
            modifiedParams.deviceMobileFirebaseToken = params.deviceMobileFirebaseToken;
        }

        if (params.password) {
            modifiedParams.password = params.password;
        }

        if (params.userName) {
            modifiedParams.userName = params.userName;
        }

        if (params.phoneNumber) {
            modifiedParams.phoneNumber = params.phoneNumber;
        }

        if (params.verificationCodes) {
            modifiedParams.verificationCodes = params.verificationCodes;
        }

        const queryString = knexBuilder.update({
            ...modifiedParams,
            updatedAt: new Date(),
        })
            .into(USERS_TABLE_NAME)
            .where(normalizedConditions)
            .returning('*')
            .toString();

        return this.db.write.query(queryString).then((response) => response.rows);
    }

    deleteUsers(conditions) {
        const queryString = knexBuilder.delete()
            .from(USERS_TABLE_NAME)
            .where(conditions)
            .toString();

        return this.db.write.query(queryString).then((response) => response.rows);
    }
}
