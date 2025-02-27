import KnexBuilder, { Knex } from 'knex';
import { AccessLevels, CurrencyTransactionMessages, UserConnectionTypes } from 'therr-js-utilities/constants';
import normalizePhoneNumber from 'therr-js-utilities/normalize-phone-number';
import formatSQLJoinAsJSON from 'therr-js-utilities/format-sql-join-as-json';
import normalizeEmail from 'normalize-email';
import { IConnection } from './connection';
import {
    INTERESTS_TABLE_NAME,
    SOCIAL_SYNCS_TABLE_NAME,
    USERS_TABLE_NAME,
    USER_CONNECTIONS_TABLE_NAME,
    USER_INTERESTS_TABLE_NAME,
} from './tableNames';

const knexBuilder: Knex = KnexBuilder({ client: 'pg' });

export interface ICreateUserParams {
    accessLevels: string | AccessLevels;
    brandVariations?: string | undefined;
    email: string;
    billingEmail?: string;
    firstName?: string;
    hasAgreedToTerms: boolean;
    isBusinessAccount?: boolean;
    isCreatorAccount?: boolean;
    settingsEmailMarketing?: boolean;
    settingsEmailBusMarketing?: boolean;
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
        let queryString: any = knexBuilder.select(['email', 'phoneNumber', 'isBusinessAccount', 'isCreatorAccount', 'isSuperUser']).from(USERS_TABLE_NAME)
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
    }: IFindUsersArgs, returning: any = ['id', 'userName', 'firstName', 'lastName', 'media', 'isSuperUser']) {
        let queryString: any = knexBuilder.select(returning).from(USERS_TABLE_NAME)
            .whereIn('id', ids || []);

        queryString = queryString.toString();
        return this.db.read.query(queryString).then((response) => response.rows);
    }

    findUsersWithInterests({
        ids,
    }: IFindUsersArgs, returning: any = ['id', 'userName', 'firstName', 'lastName', 'isSuperUser']) {
        let queryString: any = knexBuilder
            .select(returning.map((column) => `${USERS_TABLE_NAME}.${column}`))
            // .select(returning)
            .from(USERS_TABLE_NAME)
            .leftJoin(USER_INTERESTS_TABLE_NAME, (builder) => {
                // eslint-disable-next-line quotes
                builder.on(knexBuilder.raw(`("main"."users"."id" = "main"."userInterests"."userId" and "isEnabled" = true)`));
            })
            .columns([
                `${USER_INTERESTS_TABLE_NAME}.id as userInterests[].id`,
                `${USER_INTERESTS_TABLE_NAME}.userId as userInterests[].userId`,
                `${USER_INTERESTS_TABLE_NAME}.interestId as userInterests[].interestId`,
                `${USER_INTERESTS_TABLE_NAME}.score as userInterests[].score`,
                `${USER_INTERESTS_TABLE_NAME}.engagementCount as userInterests[].engagementCount`,
            ])
            .whereIn(`${USERS_TABLE_NAME}.id`, ids || []);

        queryString = queryString.toString();

        return this.db.read.query(queryString).then((response) => {
            const usersWithInterests = formatSQLJoinAsJSON(response.rows, [{ propKey: 'userInterests', propId: 'id' }]);
            const interestsIds = usersWithInterests
                .reduce((acc, cur) => [...acc, ...(cur?.userInterests || []).map((i: any) => i.interestId)], []);

            const interestsQuery: any = knexBuilder
                .select(['id', 'displayNameKey'])
                .from(INTERESTS_TABLE_NAME)
                .whereIn('id', interestsIds);

            return this.db.read.query(interestsQuery.toString()).then((interestsResponse) => {
                const interestsMap = interestsResponse.rows.reduce((acc, cur) => ({
                    ...acc,
                    [cur.id]: cur.displayNameKey,
                }), {});

                return usersWithInterests.map((user) => ({
                    ...user,
                    userInterests: user?.userInterests?.map((userInterest) => ({
                        ...userInterest,
                        displayNameKey: interestsMap[userInterest.interestId],
                    })),
                }));
            });
        });
    }

    searchUsers(
        requestingUserId,
        {
            ids,
            query,
            queryColumnName,
            limit,
            offset,
        }: ISearchUsersArgs,
        withConnections = false,
        onlyVerified = false,
        returning: any = ['id', 'userName', 'firstName', 'lastName', 'media', 'isSuperUser'],
    ) {
        const supportedSearchColumns = ['firstName', 'lastName', 'userName'];
        const MAX_LIMIT = 200;
        const throttledLimit = Math.min(limit || 100, MAX_LIMIT);
        let queryString: any = knexBuilder.select(returning).from(USERS_TABLE_NAME)
            .whereNotNull('userName')
            .andWhere('settingsIsProfilePublic', true)
            .andWhereNot('id', requestingUserId);

        if (onlyVerified) {
            queryString = queryString.andWhere(knexBuilder.raw(`"accessLevels" \\? '${AccessLevels.MOBILE_VERIFIED}'`));
        }

        queryString = queryString
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
                    if (connection.requestingUserId === requestingUserId || connection.acceptingUserId === requestingUserId) {
                        if (usersById[connection.acceptingUserId]) {
                            usersById[connection.acceptingUserId].isConnected = connection.requestStatus !== UserConnectionTypes.MIGHT_KNOW;
                        }
                        if (usersById[connection.requestingUserId]) {
                            usersById[connection.requestingUserId].isConnected = connection.requestStatus !== UserConnectionTypes.MIGHT_KNOW;
                        }
                    }
                });
                return Object.values(usersById);
            });
        });
    }

    searchUserSocials(requestingUserId, {
        ids,
        query,
        queryColumnName,
        limit,
        offset,
    }: ISearchUsersArgs, returning: any = [`${USERS_TABLE_NAME}.id`, 'userName', 'firstName', 'lastName', 'media', 'isSuperUser']) {
        const supportedSearchColumns = ['firstName', 'lastName', 'userName'];
        const MAX_LIMIT = 200;
        const throttledLimit = Math.min(limit || 100, MAX_LIMIT);
        let queryString: any = knexBuilder.select(returning).from(USERS_TABLE_NAME)
            .innerJoin(SOCIAL_SYNCS_TABLE_NAME, `${USERS_TABLE_NAME}.id`, `${SOCIAL_SYNCS_TABLE_NAME}.userId`)
            .columns([
                `${SOCIAL_SYNCS_TABLE_NAME}.id as socialSyncs[].id`,
                `${SOCIAL_SYNCS_TABLE_NAME}.userId as socialSyncs[].userId`,
                `${SOCIAL_SYNCS_TABLE_NAME}.platform as socialSyncs[].platform`,
                `${SOCIAL_SYNCS_TABLE_NAME}.platformUsername as socialSyncs[].platformUsername`,
                `${SOCIAL_SYNCS_TABLE_NAME}.displayName as socialSyncs[].displayName`,
                `${SOCIAL_SYNCS_TABLE_NAME}.link as socialSyncs[].link`,
                `${SOCIAL_SYNCS_TABLE_NAME}.followerCount as socialSyncs[].followerCount`,
            ])
            .whereNotNull('userName')
            .andWhere('settingsIsProfilePublic', true)
            .andWhereNot(`${USERS_TABLE_NAME}.id`, requestingUserId)
            .orderBy(`${USERS_TABLE_NAME}.createdAt`, 'desc')
            .limit(throttledLimit)
            .offset(offset || 0);

        if (ids) {
            queryString = queryString.whereIn(`${USERS_TABLE_NAME}.id`, ids || []);
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
        return this.db.read.query(queryString)
            .then((response) => formatSQLJoinAsJSON(response.rows, [{ propKey: 'socialSyncs', propId: 'id' }]));
    }

    findUsersByContactInfo(
        contacts: IFindUsersByContactInfo[],
        returning: any = ['id', 'email', 'phoneNumber', 'deviceMobileFirebaseToken', 'isUnclaimed', 'settingsEmailInvites', 'isSuperUser'],
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
            userName: params?.userName?.trim()?.toLowerCase(),
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

        // Normalize Email
        if (conditions.billingEmail) {
            normalizedConditions.billingEmail = normalizeEmail(conditions.billingEmail);
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

        if (params.isCreatorAccount || params.isCreatorAccount === false) {
            modifiedParams.isCreatorAccount = params.isCreatorAccount;
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

        if (params.integrationsAccess) {
            modifiedParams.integrationsAccess = JSON.stringify(params.integrationsAccess);
        }

        if (params.password) {
            modifiedParams.password = params.password;
        }

        if (params.userName) {
            modifiedParams.userName = params.userName.trim().toLowerCase();
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

        if (params.settingsIsProfilePublic != null) {
            modifiedParams.settingsIsProfilePublic = params.settingsIsProfilePublic;
        }

        if (params.settingsThemeName != null) {
            modifiedParams.settingsThemeName = params.settingsThemeName;
        }

        if (params.settingsEmailLikes != null) {
            modifiedParams.settingsEmailLikes = params.settingsEmailLikes;
        }

        if (params.settingsEmailInvites != null) {
            modifiedParams.settingsEmailInvites = params.settingsEmailInvites;
        }

        if (params.settingsEmailMentions != null) {
            modifiedParams.settingsEmailMentions = params.settingsEmailMentions;
        }

        if (params.settingsEmailMessages != null) {
            modifiedParams.settingsEmailMessages = params.settingsEmailMessages;
        }

        if (params.settingsEmailReminders != null) {
            modifiedParams.settingsEmailReminders = params.settingsEmailReminders;
        }

        if (params.settingsEmailBackground != null) {
            modifiedParams.settingsEmailBackground = params.settingsEmailBackground;
        }

        if (params.settingsEmailMarketing != null) {
            modifiedParams.settingsEmailMarketing = params.settingsEmailMarketing;
        }

        if (params.settingsEmailBusMarketing != null) {
            modifiedParams.settingsEmailBusMarketing = params.settingsEmailBusMarketing;
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
                        return client.query('ROLLBACK').then(() => ({ transactionStatus: CurrencyTransactionMessages.INSUFFICIENT_FUNDS, user: {} }));
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
            .returning(['id', 'email', 'userName', 'loginCount', 'isBusinessAccount'])
            .where(normalizedConditions)
            .toString();

        return this.db.write.query(queryString).then((response) => response.rows);
    }
}
