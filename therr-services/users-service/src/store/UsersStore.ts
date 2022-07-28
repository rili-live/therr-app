import KnexBuilder, { Knex } from 'knex';
import { AccessLevels } from 'therr-js-utilities/constants';
import normalizeEmail from 'normalize-email';
import { IConnection } from './connection';
import normalizePhoneNumber from '../utilities/normalizePhoneNumber';

const knexBuilder: Knex = KnexBuilder({ client: 'pg' });

export const USERS_TABLE_NAME = 'main.users';

export interface ICreateUserParams {
    accessLevels: string | AccessLevels;
    email: string;
    firstName?: string;
    hasAgreedToTerms: boolean;
    lastName?: string;
    password: string;
    phoneNumber?: string;
    userName?: string;
    verificationCodes: string;
}

export interface IFindUserArgs {
    id?: string;
    email?: string;
    userName?: string;
    phoneNumber?: string;
}

interface IFindUsersArgs {
    ids?: string[];
}

interface IFindUsersByContactInfo {
    email?: string;
    phoneNumber?: string;
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

    getUserById = (id: string, returning: any = '*') => {
        let queryString: any = knexBuilder.select(returning).from('main.users')
            .where({ id });

        queryString = queryString.toString();
        return this.db.read.query(queryString).then((response) => response.rows);
    }

    findUser = ({
        id,
        email,
        userName,
        phoneNumber,
    }: IFindUserArgs, returning: any = '*') => {
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
    }: IFindUsersArgs, returning: any = ['id', 'userName', 'firstName', 'lastName', 'media']) {
        let queryString: any = knexBuilder.select(returning).from('main.users')
            .whereIn('id', ids || []);

        queryString = queryString.toString();
        return this.db.read.query(queryString).then((response) => response.rows);
    }

    findUsersByContactInfo(
        contacts: IFindUsersByContactInfo[],
        returning: any = ['id', 'email', 'phoneNumber', 'deviceMobileFirebaseToken'],
    ) {
        const emails: string[] = [];
        const phoneNumbers: string[] = [];
        contacts.forEach((contact) => {
            // TODO: Format email
            if (contact.email) { emails.push(normalizeEmail(contact.email)); }
            // TODO: Format phoneNumbers to match db format
            if (contact.phoneNumber) {
                // Note: `normalizePhoneNumber` requires a country code prefix
                // we can't guess this because it could result in sending an invite to the wrong person
                const normalizedPhoneNumber = normalizePhoneNumber(contact.phoneNumber as string);
                if (normalizedPhoneNumber) {
                    phoneNumbers.push(normalizedPhoneNumber);
                }
            }
        });
        let queryString: any = knexBuilder.select(returning).from('main.users')
            .whereIn('email', emails || [])
            .orWhereIn('phoneNumber', phoneNumbers);

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

    updateUser(params, conditions: any) {
        const modifiedParams: any = {};
        const normalizedConditions: any = { ...conditions };

        if (params.accessLevels) {
            modifiedParams.accessLevels = params.accessLevels;
        }

        if (params.blockedUsers) {
            modifiedParams.blockedUsers = JSON.stringify(params.blockedUsers);
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

        if (params.media) {
            modifiedParams.media = JSON.stringify(params.media);
        }

        if (params.hasAgreedToTerms) {
            modifiedParams.hasAgreedToTerms = params.hasAgreedToTerms;
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

        if (params.wasReportedBy) {
            modifiedParams.wasReportedBy = JSON.stringify(params.wasReportedBy);
        }

        if (params.settingsBio != null) {
            modifiedParams.settingsBio = params.settingsBio;
        }

        if (params.settingsIsAccountSoftDeleted != null) {
            modifiedParams.settingsIsAccountSoftDeleted = params.settingsIsAccountSoftDeleted;
        }

        if (params.settingsThemeName != null) {
            modifiedParams.settingsThemeName = params.settingsThemeName;
        }

        if (params.shouldHideMatureContent != null) {
            modifiedParams.shouldHideMatureContent = params.shouldHideMatureContent;
        }

        // Security: Prevent updating multiple users
        if (!normalizedConditions.id && !normalizedConditions.email) {
            throw new Error('User ID or email is required to call updateUser');
        }

        let queryString: any = knexBuilder.update({
            ...modifiedParams,
            updatedAt: new Date(),
        })
            .into(USERS_TABLE_NAME)
            .where(normalizedConditions)
            .returning('*');

        if (params.settingsTherrCoinTotal != null) {
            modifiedParams.settingsTherrCoinTotal = params.settingsTherrCoinTotal;
        }

        // TODO: Ensure this is absolutely secure
        // Maybe create a separate method specifically for updating coins
        if (params.settingsTherrCoinTotal != null && params.settingsTherrCoinTotal > 0) {
            queryString = queryString.increment('settingsTherrCoinTotal', params.settingsTherrCoinTotal);
        }

        return this.db.write.query(queryString.toString()).then((response) => response.rows);
    }

    deleteUsers(conditions) {
        const normalizedConditions: any = { ...conditions };

        // Normalize Email
        if (conditions.email) {
            normalizedConditions.email = normalizeEmail(conditions.email);
        }

        // Security: Prevent updating multiple users
        if (!normalizedConditions.id && !normalizedConditions.email) {
            throw new Error('User ID or email is required to call deleteUser'); // Prevent deleting all users
        }

        const queryString = knexBuilder.delete()
            .from(USERS_TABLE_NAME)
            .where(normalizedConditions)
            .toString();

        return this.db.write.query(queryString).then((response) => response.rows);
    }
}
