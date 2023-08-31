import KnexBuilder, { Knex } from 'knex';
import { AccessLevels, UserConnectionTypes } from 'therr-js-utilities/constants';
import normalizePhoneNumber from 'therr-js-utilities/normalize-phone-number';
import normalizeEmail from 'normalize-email';
import { IConnection } from './connection';
import { USERS_TABLE_NAME, USER_CONNECTIONS_TABLE_NAME } from './tableNames';

const knexBuilder: Knex = KnexBuilder({ client: 'pg' });

export interface ICreateUserParams {
    accessLevels: string | AccessLevels;
    email: string;
    firstName?: string;
    hasAgreedToTerms: boolean;
    isBusinessAccount?: boolean;
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

interface ISearchUsersArgs {
    ids?: string[];
    query?: string;
    queryColumnName?: string;
    limit?: number;
    offset?: number;
}

export interface IFindUsersByContactInfo {
    email?: string;
    phoneNumber?: string;
}

export default class UsersStore {
    db: IConnection;

    constructor(dbConnection) {
        this.db = dbConnection;
    }

    // Deprecated
    getUsers(conditions = {}, orConditions = {}, anotherOrConditions = {}, returning = ['*']) {
        const queryString = knexBuilder.select(returning)
            .from(USERS_TABLE_NAME)
            .orderBy('id')
            .where(conditions)
            .orWhere(orConditions)
            .orWhere(anotherOrConditions)
            .toString();
        return this.db.read.query(queryString).then((response) => response.rows);
    }

    getRecentUsers(limit = 1, returning = ['id'], createdAtOrUpdatedAt = 'createdAt', operator = '>') {
        const queryString = knexBuilder.select(returning)
            .from(USERS_TABLE_NAME)
            // 1 day ago
            .where(createdAtOrUpdatedAt, operator, new Date(Date.now() - 1000 * 60 * 60 * 24))
            .limit(limit)
            .toString();
        return this.db.read.query(queryString).then((response) => response.rows);
    }

    getUserByEmail = (email: string) => {
        let queryString: any = knexBuilder.select([
            'id',
            'email',
            'isUnclaimed',
        ]).from(USERS_TABLE_NAME)
            .where({ email });

        queryString = queryString.toString();
        return this.db.read.query(queryString).then((response) => response.rows);
    };

    getByIdSimple = (id: string) => this.getUserById(id, ['id']);

    getUserById = (id: string, returning: any = '*') => {
        let queryString: any = knexBuilder.select(returning).from(USERS_TABLE_NAME)
            .where({ id });

        queryString = queryString.toString();
        return this.db.read.query(queryString).then((response) => response.rows);
    };

    getByPhoneNumber = (phoneNumber: string) => {
        const normalizedPhone = normalizePhoneNumber(phoneNumber as string);
        let queryString: any = knexBuilder.select(['email', 'phoneNumber', 'isBusinessAccount']).from(USERS_TABLE_NAME)
            .where({ phoneNumber: normalizedPhone });

        queryString = queryString.toString();
        return this.db.read.query(queryString).then((response) => response.rows);
    };

    findUser = ({
        id,
        email,
        userName,
        phoneNumber,
    }: IFindUserArgs, returning: any = '*') => {
        let queryString: any = knexBuilder.select(returning).from(USERS_TABLE_NAME)
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
    };

    findUsers({
        ids,
    }: IFindUsersArgs, returning: any = ['id', 'userName', 'firstName', 'lastName', 'media']) {
        let queryString: any = knexBuilder.select(returning).from(USERS_TABLE_NAME)
            .whereIn('id', ids || []);

        queryString = queryString.toString();
        return this.db.read.query(queryString).then((response) => response.rows);
    }

    searchUsers(requestingUserId, {
        ids,
        query,
        queryColumnName,
        limit,
        offset,
    }: ISearchUsersArgs, withConnections = false, returning: any = ['id', 'userName', 'firstName', 'lastName', 'media']) {
        const supportedSearchColumns = ['firstName', 'lastName', 'userName'];
        const MAX_LIMIT = 200;
        const throttledLimit = Math.min(limit || 100, MAX_LIMIT);
        let queryString: any = knexBuilder.select(returning).from(USERS_TABLE_NAME)
            .whereNotNull('userName')
            .andWhere('settingsIsProfilePublic', true)
            .andWhereNot('id', requestingUserId)
            .orderBy('createdAt', 'desc')
            .limit(throttledLimit)
            .offset(offset || 0);

        if (ids) {
            queryString = queryString.whereIn('id', ids || []);
        }

        if (query) {
            if (supportedSearchColumns.includes(queryColumnName || '')) {
                queryString = queryString.where(queryColumnName, 'ilike', `%${query}%`);
            } else {
                queryString = queryString.where((builder) => {
                    builder.where('firstName', 'ilike', `%${query}%`)
                        .orWhere('lastName', 'ilike', `%${query}%`)
                        .orWhere('userName', 'ilike', `%${query}%`);
                });
            }
        }

        queryString = queryString.toString();
        return this.db.read.query(queryString).then((response) => {
            if (!response.rows?.length) {
                return [];
            }

            if (!withConnections) {
                return response.rows;
            }

            const users = response.rows;
            const userIds = users.map((user) => user.id);
            const usersById = users.reduce((acc, cur) => {
                acc[cur.id] = cur;
                return acc;
            }, {});

            const connectionsQueryString: any = knexBuilder.select('*').from(USER_CONNECTIONS_TABLE_NAME)
                .where((builder) => {
                    builder.where('requestingUserId', requestingUserId)
                        .whereIn('acceptingUserId', userIds);
                }).orWhere((builder) => {
                    builder.where('acceptingUserId', requestingUserId)
                        .whereIn('requestingUserId', userIds);
                });

            return this.db.read.query(connectionsQueryString.toString()).then(({ rows: connections }) => {
                connections.forEach((connection) => {
                    if (connection.requestingUserId === requestingUserId) {
                        usersById[connection.acceptingUserId].isConnected = connection.requestStatus !== UserConnectionTypes.MIGHT_KNOW;
                    }
                });
                return Object.values(usersById);
            });
        });
    }

    findUsersByContactInfo(
        contacts: IFindUsersByContactInfo[],
        returning: any = ['id', 'email', 'phoneNumber', 'deviceMobileFirebaseToken', 'isUnclaimed'],
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
        let queryString: any = knexBuilder.select(returning).from(USERS_TABLE_NAME)
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

        if (params.isBusinessAccount || params.isBusinessAccount === false) {
            modifiedParams.isBusinessAccount = params.isBusinessAccount;
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

        if (params.settingsPushMarketing != null) {
            modifiedParams.settingsPushMarketing = params.settingsPushMarketing;
        }

        if (params.settingsPushBackground != null) {
            modifiedParams.settingsPushBackground = params.settingsPushBackground;
        }

        if (params.shouldHideMatureContent != null) {
            modifiedParams.shouldHideMatureContent = params.shouldHideMatureContent;
        }

        if (params.lastKnownLatitude != null && params.lastKnownLongitude != null) {
            modifiedParams.lastKnownLatitude = params.lastKnownLatitude;
            modifiedParams.lastKnownLongitude = params.lastKnownLongitude;
            modifiedParams.lastKnownLocation = knexBuilder.raw(`ST_SetSRID(ST_MakePoint(${params.lastKnownLongitude}, ${params.lastKnownLatitude}), 4326)`);
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

        // TODO: Ensure this is absolutely secure
        // Maybe create a separate method specifically for updating coins
        if (params.settingsTherrCoinTotal != null && params.settingsTherrCoinTotal > 0) {
            const totalRounded = Math.round((Number(params.settingsTherrCoinTotal || 0) + Number.EPSILON) * 100) / 100;
            queryString = queryString.increment('settingsTherrCoinTotal', totalRounded);
        }

        return this.db.write.query(queryString.toString()).then((response) => response.rows);
    }

    transferTherrCoin(fromUserId: string, toUserId: string, amount: number) {
        return this.db.write.connect()
            .then((client) => client.query('BEGIN')
                .then(() => {
                    // 1. Attempt to reduce the fromUserId's coin total
                    const decrementQueryString = knexBuilder
                        .from(USERS_TABLE_NAME)
                        .returning(['id', 'settingsTherrCoinTotal'])
                        .where({ id: fromUserId })
                        .decrement('settingsTherrCoinTotal', amount)
                        .toString();

                    return client.query(decrementQueryString).then((response) => response.rows[0]);
                })
                .then((decrementedUser) => {
                    if (decrementedUser?.settingsTherrCoinTotal < 0) {
                        return client.query('ROLLBACK').then(() => ({ transactionStatus: 'insufficient-funds', user: {} }));
                    }

                    // 2. Attempt to increment the toUserId's coin total
                    const incrementQueryString = knexBuilder
                        .from(USERS_TABLE_NAME)
                        .returning(['id', 'settingsTherrCoinTotal'])
                        .where({ id: toUserId })
                        .increment('settingsTherrCoinTotal', amount)
                        .toString();

                    return client.query(incrementQueryString)
                        .then((incrResponse) => client.query('COMMIT').then(() => ({
                            transactionStatus: 'success',
                            user: incrResponse.rows?.[0],
                        })))
                        .catch((err) => ({ transactionStatus: 'increment-failed', error: err?.message }));
                })
                .catch((err) => {
                    console.log(err);
                    return client.query('ROLLBACK').then(() => ({ transactionStatus: 'unknown', error: err?.message }));
                }) // rollback if either fail
                .finally(() => {
                    client.release();
                }));
    }

    sumTotalCoins() {
        const queryString = knexBuilder
            .from(USERS_TABLE_NAME)
            .sum('settingsTherrCoinTotal as totalTherrCoinSupply')
            .toString();

        return this.db.read.query(queryString).then((response) => response.rows);
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
