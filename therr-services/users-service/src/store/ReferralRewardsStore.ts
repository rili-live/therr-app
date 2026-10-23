import KnexBuilder, { Knex } from 'knex';
import { BrandVariations } from 'therr-js-utilities/constants';
import { IConnection } from './connection';
import { INVITES_TABLE_NAME } from './InvitesStore';
import {
    CHALLENGES_TABLE_NAME,
    CHALLENGE_MEMBERS_TABLE_NAME,
    HABIT_CHECKINS_TABLE_NAME,
    PACTS_TABLE_NAME,
    PACT_MEMBERS_TABLE_NAME,
    REFERRAL_REWARDS_TABLE_NAME,
    USERS_TABLE_NAME,
} from './tableNames';

const knexBuilder: Knex = KnexBuilder({ client: 'pg' });

/**
 * How long before the invite (or the challenge join) a friend's account may have been created
 * and still count as someone this user brought in.
 *
 * Zero would miss the ordinary path: a pact invite to an unknown email creates the placeholder
 * account in the same request, but a challenge joiner registers on the web, verifies their
 * email and only then joins, which can take days. Unbounded would let a user "bring" friends who
 * were using the app long before they were invited.
 */
export const REFERRAL_ACCOUNT_AGE_TOLERANCE = '7 days';

export interface IReferralRewardRow {
    id: string;
    userId: string;
    qualifyingUserIds: string[];
    grantedAt: Date;
    createdAt: Date;
}

export interface IReferredFriendRow {
    userId: string;
    userName: string;
    accessLevels: string[] | null;
    /** Distinct days with at least one completed check-in, on any habit. */
    activeDays: number;
}

/**
 * Who a user brought into Friends with Habits, through any of the three ways in:
 *
 *   1. A pact they created, as a partner.
 *   2. A challenge they created, as a member who joined from the link.
 *   3. A HABITS magic invite (main.invites) they sent, matched on email or phone.
 *
 * In every case the friend's account must be about as new as the invite (see
 * REFERRAL_ACCOUNT_AGE_TOLERANCE): inviting an existing user is welcome, but it is not
 * bringing a new person into the app, which is what the reward pays for.
 *
 * Bindings, in order: referrerUserId ×3 for the three branches, plus the brand.
 */
const BROUGHT_BY_REFERRER_SQL = `
    SELECT pm."userId" AS "friendId"
    FROM ${PACT_MEMBERS_TABLE_NAME} pm
    INNER JOIN ${PACTS_TABLE_NAME} p ON p.id = pm."pactId"
    INNER JOIN ${USERS_TABLE_NAME} fu ON fu.id = pm."userId"
    WHERE p."creatorUserId" = :referrerUserId
        AND pm.role = 'partner'
        AND pm."userId" <> :referrerUserId
        AND fu."createdAt" >= pm."createdAt" - interval '${REFERRAL_ACCOUNT_AGE_TOLERANCE}'
    UNION
    SELECT cm."userId" AS "friendId"
    FROM ${CHALLENGE_MEMBERS_TABLE_NAME} cm
    INNER JOIN ${CHALLENGES_TABLE_NAME} c ON c.id = cm."challengeId"
    INNER JOIN ${USERS_TABLE_NAME} fu ON fu.id = cm."userId"
    WHERE c."creatorUserId" = :referrerUserId
        AND cm."userId" <> :referrerUserId
        AND fu."createdAt" >= cm."joinedAt" - interval '${REFERRAL_ACCOUNT_AGE_TOLERANCE}'
    UNION
    SELECT fu.id AS "friendId"
    FROM ${INVITES_TABLE_NAME} i
    INNER JOIN ${USERS_TABLE_NAME} fu
        ON (i.email IS NOT NULL AND lower(fu.email) = lower(i.email))
        OR (i."phoneNumber" IS NOT NULL AND fu."phoneNumber" = i."phoneNumber")
    WHERE i."requestingUserId" = :referrerUserId
        AND i."brandVariation" = :brand
        AND fu.id <> :referrerUserId
        AND fu."createdAt" >= i."createdAt" - interval '${REFERRAL_ACCOUNT_AGE_TOLERANCE}'
`;

/** The inverse of BROUGHT_BY_REFERRER_SQL: everyone who brought `friendUserId` in. */
const REFERRERS_OF_FRIEND_SQL = `
    SELECT p."creatorUserId" AS "referrerUserId"
    FROM ${PACT_MEMBERS_TABLE_NAME} pm
    INNER JOIN ${PACTS_TABLE_NAME} p ON p.id = pm."pactId"
    INNER JOIN ${USERS_TABLE_NAME} fu ON fu.id = pm."userId"
    WHERE pm."userId" = :friendUserId
        AND pm.role = 'partner'
        AND p."creatorUserId" <> :friendUserId
        AND fu."createdAt" >= pm."createdAt" - interval '${REFERRAL_ACCOUNT_AGE_TOLERANCE}'
    UNION
    SELECT c."creatorUserId" AS "referrerUserId"
    FROM ${CHALLENGE_MEMBERS_TABLE_NAME} cm
    INNER JOIN ${CHALLENGES_TABLE_NAME} c ON c.id = cm."challengeId"
    INNER JOIN ${USERS_TABLE_NAME} fu ON fu.id = cm."userId"
    WHERE cm."userId" = :friendUserId
        AND c."creatorUserId" <> :friendUserId
        AND fu."createdAt" >= cm."joinedAt" - interval '${REFERRAL_ACCOUNT_AGE_TOLERANCE}'
    UNION
    SELECT i."requestingUserId" AS "referrerUserId"
    FROM ${INVITES_TABLE_NAME} i
    INNER JOIN ${USERS_TABLE_NAME} fu
        ON (i.email IS NOT NULL AND lower(fu.email) = lower(i.email))
        OR (i."phoneNumber" IS NOT NULL AND fu."phoneNumber" = i."phoneNumber")
    WHERE fu.id = :friendUserId
        AND i."brandVariation" = :brand
        AND i."requestingUserId" <> :friendUserId
        AND fu."createdAt" >= i."createdAt" - interval '${REFERRAL_ACCOUNT_AGE_TOLERANCE}'
`;

/**
 * The founder-unlock referral reward. See `handlers/helpers/referralReward.ts` for the rules.
 */
export default class ReferralRewardsStore {
    db: IConnection;

    constructor(dbConnection: IConnection) {
        this.db = dbConnection;
    }

    getByUserId(userId: string): Promise<IReferralRewardRow | undefined> {
        const queryString = knexBuilder
            .from(REFERRAL_REWARDS_TABLE_NAME)
            .where({ userId })
            .toString();

        return this.db.read.query(queryString).then((response) => response.rows[0]);
    }

    /**
     * Record the grant. Returns undefined when a row already existed, which is how a second,
     * racing evaluation learns it must grant and announce nothing.
     */
    createIfAbsent(userId: string, qualifyingUserIds: string[]): Promise<IReferralRewardRow | undefined> {
        const queryString = knexBuilder.raw(
            `INSERT INTO ${REFERRAL_REWARDS_TABLE_NAME} ("userId", "qualifyingUserIds")
            VALUES (?, ?::jsonb)
            ON CONFLICT ("userId") DO NOTHING
            RETURNING *`,
            [userId, JSON.stringify(qualifyingUserIds)],
        ).toString();

        return this.db.write.query(queryString).then((response) => response.rows[0]);
    }

    /** Every friend this user brought in, with how many days each has been active. */
    getReferredFriends(referrerUserId: string): Promise<IReferredFriendRow[]> {
        const queryString = knexBuilder.raw(
            `WITH brought AS (${BROUGHT_BY_REFERRER_SQL})
            SELECT
                b."friendId" AS "userId",
                u."userName",
                u."accessLevels",
                (
                    SELECT COUNT(DISTINCT ch."scheduledDate")
                    FROM ${HABIT_CHECKINS_TABLE_NAME} ch
                    WHERE ch."userId" = b."friendId" AND ch.status = 'completed'
                )::int AS "activeDays"
            FROM brought b
            INNER JOIN ${USERS_TABLE_NAME} u ON u.id = b."friendId"
            ORDER BY "activeDays" DESC, u."userName" ASC`,
            { referrerUserId, brand: BrandVariations.HABITS },
        ).toString();

        return this.db.read.query(queryString).then((response) => response.rows.map((row: any) => ({
            ...row,
            activeDays: Number(row.activeDays) || 0,
        })));
    }

    /** Everyone who brought this user in — whose reward may have just moved when they checked in. */
    getReferrersOf(friendUserId: string): Promise<string[]> {
        const queryString = knexBuilder.raw(
            REFERRERS_OF_FRIEND_SQL,
            { friendUserId, brand: BrandVariations.HABITS },
        ).toString();

        return this.db.read.query(queryString)
            .then((response) => response.rows.map((row: any) => row.referrerUserId));
    }
}
