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

// Shared brand-membership predicate. main.users is identity-shared (no brand column);
// enrollment lives in the brandVariations JSONB array, e.g. [{ brand: 'habits', ... }].
// The @> containment check is backed by the GIN index added in brandVariations_v2.
// Legacy rows carry the column's default 'therr' entry, so Therr discovery still returns
// pre-existing accounts without a separate backfill.
// `qualifier` must be a trusted, code-supplied table name (never user input) — it is
// interpolated via knex's ?? identifier binding. Pass it whenever the query joins another
// table, so "brandVariations" cannot become ambiguous if a joined table ever grows a
// column of the same name.
const brandContainment = (brand: string, qualifier?: string) => (qualifier
    ? knexBuilder.raw(
        '??."brandVariations" @> ?::jsonb',
        [qualifier, JSON.stringify([{ brand }])],
    )
    : knexBuilder.raw(
        '"brandVariations" @> ?::jsonb',
        [JSON.stringify([{ brand }])],
    ));

/**
 * The single dialect this store writes: display format, e.g. `"+1 317-555-1234"`.
 *
 * Chosen because it is what the phone-verification flow already stored (the gateway normalizes
 * before calling `updatePhoneVerification`) and what the passwordless register token carries,
 * so making `createUser` / `updateUser` agree costs nothing and stops new rows from diverging.
 *
 * Non-phone values pass through untouched: `normalizePhoneNumber` returns its input verbatim
 * when it cannot parse it, which is what keeps the `'apple-sso'` sentinel that Apple SSO
 * signups write into this column intact. That sentinel is also why the column can never carry
 * a phone-format CHECK constraint.
 */
const normalizePhoneNumberForStorage = <T extends string | undefined>(phoneNumber: T): T => (
    phoneNumber ? normalizePhoneNumber(phoneNumber) as T : phoneNumber
);

/**
 * Every spelling of `phoneNumber` that could plausibly be sitting in `main.users.phoneNumber`.
 *
 * Writes are normalized (see above), but rows written *before* that was true hold whichever
 * dialect their caller happened to pass: `createUser` / `updateUser` stored
 * `req.body.phoneNumber` verbatim, so a profile save left compact E.164 (`"+13175551234"`)
 * where `updatePhoneVerification` left display format (`"+1 317-555-1234"`). Normalizing only
 * the query side therefore matched one dialect and silently missed the other — and because
 * passwordless sign-in is deliberately enumeration-safe, that miss surfaced as "no SMS ever
 * arrives" rather than as an error. Matching the whole candidate set is the only lookup that
 * works against both, and it must stay until the legacy rows are backfilled.
 *
 * Widening a WHERE clause can only ever find *more* rows for the same handset, so this is safe
 * for the "is this number already taken?" callers too — it makes that check more correct, not
 * less.
 */
const phoneNumberMatchCandidates = (phoneNumber: string): string[] => {
    const normalized = normalizePhoneNumber(phoneNumber);
    const digits = normalized.replace(/[^\d]/g, '');

    return [...new Set([
        normalized,
        phoneNumber,
        // `normalizePhoneNumber` keeps the leading `+` only when its input had one, so derive
        // both compact forms rather than assuming which side of that branch we came out on.
        digits && `+${digits}`,
        digits,
    ].filter(Boolean))];
};

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
    settingsBirthdate?: string;
    settingsLocale?: string;
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
    // When set, restrict results to users enrolled in this brand (same identity-shared
    // pattern as searchUsers). Used by discovery / People-You-May-Know so niche apps do
    // not surface cross-brand accounts. Omit for brand-agnostic lookups (e.g. thought authors).
    brandVariation?: string;
}

interface ISearchUsersArgs {
    ids?: string[];
    query?: string;
    queryColumnName?: string;
    limit?: number;
    offset?: number;
    // When set, discovery is scoped to users enrolled in this brand (identity-shared
    // pattern: main.users has no brand column, membership lives in the brandVariations
    // JSONB array). See docs/NICHE_APP_DATABASE_GUIDELINES.md.
    brandVariation?: string;
}

export interface IFindUsersByContactInfo {
    email?: string;
    phoneNumber?: string;
}

/**
 * One user's habit-reminder delivery settings, as `getHabitReminderPreferences`
 * returns them. The three time-valued fields are Postgres `time` columns and
 * arrive as 'HH:MM:SS' strings; `parseTimeOfDay` in
 * `utilities/localReminderSchedule.ts` is the only thing that should read them.
 */
export interface IHabitReminderPreferenceRow {
    id: string;
    settingsTimezone: string | null;
    settingsPreferredReminderTime: string | null;
    settingsQuietHoursStart: string | null;
    settingsQuietHoursEnd: string | null;
    settingsPushHabitReminders: boolean | null;
    settingsPushStreakAlerts: boolean | null;
}

export default class UsersStore {
    db: IConnection;

    constructor(dbConnection) {
        this.db = dbConnection;
    }

    // Deprecated: Use getUserByConditions for single-user lookups
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

    /**
     * Optimized single-user lookup by multiple OR conditions.
     * Uses LIMIT 1 and avoids full table scan unlike getUsers().
     */
    getUserByConditions(conditions: Record<string, any>, orConditions?: Record<string, any>, anotherOrConditions?: Record<string, any>, returning = ['*']) {
        let queryString: any = knexBuilder.select(returning)
            .from(USERS_TABLE_NAME)
            .where(conditions);

        if (orConditions && Object.keys(orConditions).length > 0) {
            queryString = queryString.orWhere(orConditions);
        }
        if (anotherOrConditions && Object.keys(anotherOrConditions).length > 0) {
            queryString = queryString.orWhere(anotherOrConditions);
        }

        queryString = queryString.limit(1).toString();
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

    /**
     * Full rows for every non-deleted account attached to a phone number, newest last.
     *
     * The single entry point for "which accounts hold this number?". Both the accounts-per-
     * phone cap (`createUser` / `updateUser` / `getUserByPhoneNumber`) and passwordless
     * sign-in (which mints a session from the row) need to see *all* matches, since a number
     * may hold one personal + one creator + one business account.
     */
    getAllByPhoneNumber = (phoneNumber: string, returning: any = '*') => {
        const queryString = knexBuilder.select(returning)
            .from(USERS_TABLE_NAME)
            .where({
                settingsIsAccountSoftDeleted: false,
            })
            .whereIn('phoneNumber', phoneNumberMatchCandidates(phoneNumber as string))
            .orderBy('createdAt', 'asc')
            .toString();

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
            // Candidate-matched for the same reason as the lookups above, and additionally
            // because writes are now normalized: an exact match would miss a row this store
            // itself reformatted on the way in.
            // NOTE: this OR is a *find*, not a uniqueness check — it backs contact matching
            // (see `userConnections`). Registration deliberately does not pass `phoneNumber`
            // here, because a number may legitimately hold one account per type; that cap is
            // enforced against `getAllByPhoneNumber` in the `createUser` handler.
            queryString = queryString.orWhereIn('phoneNumber', phoneNumberMatchCandidates(phoneNumber));
        }

        queryString = queryString.toString();
        return this.db.read.query(queryString).then((response) => response.rows);
    };

    findUsers({
        ids,
        brandVariation,
    }: IFindUsersArgs, returning: any = ['id', 'userName', 'firstName', 'lastName', 'media', 'isSuperUser']) {
        let queryString: any = knexBuilder.select(returning).from(USERS_TABLE_NAME)
            .whereIn('id', ids || []);

        if (brandVariation) {
            // Brand-scope discovery lookups so niche apps do not surface cross-brand users
            // (e.g. Habits showing pre-existing Therr accounts via People-You-May-Know).
            queryString = queryString.andWhere(brandContainment(brandVariation));
        }

        queryString = queryString.toString();
        return this.db.read.query(queryString).then((response) => response.rows);
    }

    /**
     * The reminder-delivery settings for a batch of users, keyed by user id.
     *
     * One query for a whole digest run, in the same spirit as
     * `HabitCheckinsStore.getCompletedOnDateForPairs`: the alternative is a
     * `findUser` per recipient, which turns a background job into one round trip
     * per user against the read pool.
     *
     * Every column here has existed since the habits schema landed
     * (`20260126000010_main.users_habits.js`) and, until the per-user reminder
     * scheduling in `utilities/localReminderSchedule.ts`, **nothing ever read
     * any of them** — a settings surface that silently did nothing. The two
     * booleans default to `true` in the schema, so a user who has never touched
     * them keeps receiving reminders; only an explicit `false` suppresses.
     */
    getHabitReminderPreferences(userIds: string[]): Promise<Record<string, IHabitReminderPreferenceRow>> {
        if (!userIds.length) {
            return Promise.resolve({});
        }

        const queryString = knexBuilder
            .select([
                'id',
                'settingsTimezone',
                'settingsPreferredReminderTime',
                'settingsQuietHoursStart',
                'settingsQuietHoursEnd',
                'settingsPushHabitReminders',
                'settingsPushStreakAlerts',
            ])
            .from(USERS_TABLE_NAME)
            .whereIn('id', userIds)
            .toString();

        return this.db.read.query(queryString).then((response) => response.rows.reduce(
            (acc: Record<string, IHabitReminderPreferenceRow>, row: IHabitReminderPreferenceRow) => {
                acc[row.id] = row;
                return acc;
            },
            {},
        ));
    }

    findUsersWithInterests({
        ids,
    }: IFindUsersArgs, returning: any = ['id', 'userName', 'firstName', 'lastName', 'isSuperUser']) {
        // Single query with triple JOIN: users -> userInterests -> interests
        let queryString: any = knexBuilder
            .select(returning.map((column) => `${USERS_TABLE_NAME}.${column}`))
            .from(USERS_TABLE_NAME)
            .leftJoin(USER_INTERESTS_TABLE_NAME, (builder) => {
                // eslint-disable-next-line quotes
                builder.on(knexBuilder.raw(`("main"."users"."id" = "main"."userInterests"."userId" and "isEnabled" = true)`));
            })
            .leftJoin(INTERESTS_TABLE_NAME, `${USER_INTERESTS_TABLE_NAME}.interestId`, `${INTERESTS_TABLE_NAME}.id`)
            .columns([
                `${USER_INTERESTS_TABLE_NAME}.id as userInterests[].id`,
                `${USER_INTERESTS_TABLE_NAME}.userId as userInterests[].userId`,
                `${USER_INTERESTS_TABLE_NAME}.interestId as userInterests[].interestId`,
                `${USER_INTERESTS_TABLE_NAME}.score as userInterests[].score`,
                `${USER_INTERESTS_TABLE_NAME}.engagementCount as userInterests[].engagementCount`,
                `${INTERESTS_TABLE_NAME}.displayNameKey as userInterests[].displayNameKey`,
            ])
            .whereIn(`${USERS_TABLE_NAME}.id`, ids || []);

        queryString = queryString.toString();

        return this.db.read.query(queryString).then((response) => formatSQLJoinAsJSON(response.rows, [{ propKey: 'userInterests', propId: 'id' }]));
    }

    searchUsers(
        requestingUserId,
        {
            ids,
            query,
            queryColumnName,
            limit,
            offset,
            brandVariation,
        }: ISearchUsersArgs,
        withConnections = false,
        onlyVerified = false,
        returning: any = ['id', 'userName', 'firstName', 'lastName', 'media', 'isSuperUser', 'settingsBio'],
    ) {
        const supportedSearchColumns = ['firstName', 'lastName', 'userName'];
        const MAX_LIMIT = 200;
        const throttledLimit = Math.min(limit || 100, MAX_LIMIT);
        let queryString: any = knexBuilder.select(returning).from(USERS_TABLE_NAME)
            .whereNotNull('userName')
            .andWhere('settingsIsProfilePublic', true)
            .andWhereNot('id', requestingUserId);

        if (brandVariation) {
            // Scope discovery to users enrolled in the requesting brand (see brandContainment).
            queryString = queryString.andWhere(brandContainment(brandVariation));
        }

        if (onlyVerified) {
            // Discovery surfaces any verified account — email OR mobile. Requiring
            // MOBILE_VERIFIED alone silently emptied the People list once onboarding
            // stopped forcing phone verification (feat(users): reduce onboarding
            // friction): most users now carry EMAIL_VERIFIED but never complete mobile
            // verification, so the single-level `?` filter matched nobody. The jsonb
            // `?|` operator matches when accessLevels contains ANY of the listed levels.
            // AccessLevels values are trusted enum constants, so inlining them is safe.
            queryString = queryString.andWhere(knexBuilder.raw(
                `"accessLevels" \\?| ARRAY['${AccessLevels.MOBILE_VERIFIED}', '${AccessLevels.EMAIL_VERIFIED}']::text[]`,
            ));
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
        brandVariation,
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

        if (brandVariation) {
            // Influencer-pairing discovery is brand-scoped for the same reason searchUsers is:
            // main.users is identity-shared, so without this a Habits/Teem dashboard surfaces
            // Therr accounts. Qualified because this query joins socialSyncs.
            queryString = queryString.andWhere(brandContainment(brandVariation, USERS_TABLE_NAME));
        }

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
        brandVariation: string | undefined = undefined,
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
        // Group the email/phone OR so a brand filter ANDs against the whole match set
        // (avoids `email IN (...) OR (phone IN (...) AND brand)` precedence bugs).
        let queryString: any = knexBuilder.select(returning).from(USERS_TABLE_NAME)
            .where((builder) => {
                builder.whereIn('email', emails || [])
                    .orWhereIn('phoneNumber', phoneNumbers);
            });

        if (brandVariation) {
            // Brand-scope contact matching so we neither suggest nor seed MIGHT_KNOW edges
            // to cross-brand accounts (e.g. a Therr-only contact surfacing inside Habits).
            queryString = queryString.andWhere(brandContainment(brandVariation));
        }

        queryString = queryString.toString();
        return this.db.read.query(queryString).then((response) => response.rows);
    }

    createUser(params: ICreateUserParams) {
        const sanitizedParams = {
            ...params,
            userName: params?.userName?.trim()?.toLowerCase(),
            email: normalizeEmail(params.email),
            phoneNumber: normalizePhoneNumberForStorage(params.phoneNumber),
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

        if (params.lastLoginAt) {
            // This query is serialized with knex's `.toString()`, which renders a JS Date
            // into the Node process's local timezone with no offset. Postgres then parses
            // that naive literal in the DB session's timezone, shifting the stored value on
            // any non-UTC host. An explicit UTC ISO-8601 string is unambiguous to both.
            modifiedParams.lastLoginAt = new Date(params.lastLoginAt).toISOString();
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
            modifiedParams.phoneNumber = normalizePhoneNumberForStorage(params.phoneNumber);
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

        if (params.settingsIsLeaderboardEnabled != null) {
            modifiedParams.settingsIsLeaderboardEnabled = params.settingsIsLeaderboardEnabled;
        }

        if (params.settingsContentAlgorithm != null) {
            modifiedParams.settingsContentAlgorithm = params.settingsContentAlgorithm;
        }

        if (params.settingsLocale != null) {
            modifiedParams.settingsLocale = params.settingsLocale;
        }

        // The user's IANA timezone, reported by the mobile client on every push
        // registration. Validated in the handler (`isValidTimeZone`) rather than
        // here, because an unrecognised zone must fail the request loudly instead
        // of being written and then silently falling back on every digest run.
        if (params.settingsTimezone != null) {
            modifiedParams.settingsTimezone = params.settingsTimezone;
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

        // `!= null` rather than a truthiness check, deliberately and load-bearingly here:
        // `false` is the only value that does anything. Both columns default to `true` and
        // the digest mutes on an explicit `false` and nothing else (`handlers/habitsDigest`),
        // so a truthy guard would accept every opt-in and silently discard every opt-out —
        // the mute would appear to save and then keep sending.
        if (params.settingsPushHabitReminders != null) {
            modifiedParams.settingsPushHabitReminders = params.settingsPushHabitReminders;
        }

        if (params.settingsPushStreakAlerts != null) {
            modifiedParams.settingsPushStreakAlerts = params.settingsPushStreakAlerts;
        }

        if (params.shouldHideMatureContent != null) {
            modifiedParams.shouldHideMatureContent = params.shouldHideMatureContent;
        }

        if (params.autoRechargeEnabled !== undefined) {
            modifiedParams.autoRechargeEnabled = params.autoRechargeEnabled;
        }

        if (params.autoRechargeThresholdCoins !== undefined) {
            modifiedParams.autoRechargeThresholdCoins = params.autoRechargeThresholdCoins;
        }

        if (params.autoRechargePackageId !== undefined) {
            modifiedParams.autoRechargePackageId = params.autoRechargePackageId;
        }

        if (params.lastKnownLatitude != null && params.lastKnownLongitude != null) {
            modifiedParams.lastKnownLatitude = params.lastKnownLatitude;
            modifiedParams.lastKnownLongitude = params.lastKnownLongitude;
            modifiedParams.lastKnownLocation = knexBuilder.raw('ST_SetSRID(ST_MakePoint(?, ?), 4326)', [params.lastKnownLongitude, params.lastKnownLatitude]);
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

    // Append or refresh a brand-variation membership entry on the user record.
    // Uses a single JSONB statement so concurrent logins from different brands cannot lose entries.
    // - If an entry for the brand exists, bump its lastSeenAt.
    // - Otherwise append a new entry with firstSeenAt = lastSeenAt = now() and isActive = true.
    upsertBrandVariation(userId: string, brand: string) {
        if (!userId || !brand) return Promise.resolve();
        const queryString = knexBuilder
            .raw(
                `UPDATE ?? SET "brandVariations" = (
                    CASE WHEN EXISTS (
                        SELECT 1 FROM jsonb_array_elements("brandVariations") AS elem
                        WHERE elem->>'brand' = ?
                    )
                    THEN (
                        SELECT jsonb_agg(
                            CASE WHEN elem->>'brand' = ?
                                THEN jsonb_set(elem, '{lastSeenAt}', to_jsonb(now()::text))
                                ELSE elem
                            END
                        )
                        FROM jsonb_array_elements("brandVariations") AS elem
                    )
                    ELSE "brandVariations" || jsonb_build_array(
                        jsonb_build_object(
                            'brand', ?::text,
                            'firstSeenAt', now()::text,
                            'lastSeenAt', now()::text,
                            'isActive', true
                        )
                    )
                    END
                )
                WHERE id = ?`,
                [USERS_TABLE_NAME, brand, brand, brand, userId],
            )
            .toString();
        return this.db.write.query(queryString);
    }

    // Clears the stored FCM device token for a user, but only if the currently
    // stored token matches the one we know to be invalid. This avoids a race
    // where the mobile client has already rotated the token between the time a
    // send failed and the push service noticed the failure.
    clearDeviceToken(userId: string, invalidToken: string) {
        const queryString = knexBuilder
            .update({ deviceMobileFirebaseToken: null, updatedAt: new Date() })
            .into(USERS_TABLE_NAME)
            .where({ id: userId, deviceMobileFirebaseToken: invalidToken })
            .returning(['id'])
            .toString();

        return this.db.write.query(queryString).then((response) => response.rows);
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
