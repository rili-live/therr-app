import KnexBuilder, { Knex } from 'knex';
import { IConnection } from './connection';
import {
    HABIT_CHECKINS_TABLE_NAME,
    HABIT_GOALS_TABLE_NAME,
    ONBOARDING_MESSAGES_TABLE_NAME,
    PACTS_TABLE_NAME,
    PACT_MEMBERS_TABLE_NAME,
    USER_HABITS_TABLE_NAME,
    USERS_TABLE_NAME,
} from './tableNames';

const knexBuilder: Knex = KnexBuilder({ client: 'pg' });

export type OnboardingMessageChannel = 'push' | 'email';

/** A Habits account with no habit and no pact, a day or more after it joined. */
export interface INoHabitCandidateRow {
    userId: string;
    email: string | null;
    firstName: string | null;
    userName: string | null;
    isUnclaimed: boolean | null;
    settingsEmailReminders: boolean | null;
    settingsLocale: string | null;
}

/** A Habits account that has earned the founder offer by checking in, still without a partner. */
export interface IFounderOfferCandidateRow {
    userId: string;
    accessLevels: string[] | null;
    completedCheckins: number;
    settingsPushMarketing: boolean | null;
}

/** An unanswered invite, as the inviter-side resend prompt reads it. */
export interface IUnclaimedSeatRow {
    pactMemberId: string;
    pactId: string;
    creatorUserId: string;
    inviteeUserId: string;
    habitGoalName: string | null;
}

/** An emailed claim-link invite still open, as the seat-expiry reminder reads it. */
export interface IExpiringSeatRow {
    pactMemberId: string;
    pactId: string;
    creatorUserId: string;
    inviteeUserId: string;
    habitGoalName: string | null;
    claimToken: string;
    claimCode: string | null;
    claimTokenExpiresAt: Date | string;
    email: string | null;
    firstName: string | null;
    isUnclaimed: boolean | null;
    settingsEmailInvites: boolean | null;
    settingsLocale: string | null;
}

// The brand entry's firstSeenAt, as a timestamp. Guarded by a shape check so one malformed entry
// cannot fail the cast for the whole read. `brand` is bound, never interpolated.
const brandFirstSeenSql = `(SELECT (e->>'firstSeenAt')::timestamptz FROM jsonb_array_elements(u."brandVariations") AS e
    WHERE e->>'brand' = ? AND e->>'firstSeenAt' ~ '^\\d{4}-\\d{2}-\\d{2}' LIMIT 1)`;

const notClaimedSql = (userColumn: string) => `NOT EXISTS (SELECT 1 FROM ${ONBOARDING_MESSAGES_TABLE_NAME} AS o`
    + ` WHERE o."userId" = ${userColumn} AND o."messageKey" = ?)`;

const notClaimedForSeatSql = (userColumn: string, suffix: string) => `NOT EXISTS (SELECT 1 FROM ${ONBOARDING_MESSAGES_TABLE_NAME} AS o`
    + ` WHERE o."userId" = ${userColumn} AND o."messageKey" = 'seat:' || pm."id" || ':${suffix}')`;

/**
 * The Habits onboarding nurture sequence's once-ever ledger and its candidate reads.
 * See migration 20261008000002 for why a ledger, and handlers/helpers/onboardingNurtureDigest.ts
 * for the sequence.
 *
 * Every candidate read leaves out users already claimed for that message, so a capped read is
 * never spent on rows that can never send.
 */
export default class OnboardingMessagesStore {
    db: IConnection;

    constructor(dbConnection: IConnection) {
        this.db = dbConnection;
    }

    /**
     * Claim a message for a user before sending it. False when it was already claimed — by an
     * earlier run, an overlapping one, or a retry — and the caller must then send nothing.
     */
    claim(userId: string, messageKey: string, channel: OnboardingMessageChannel): Promise<boolean> {
        const queryString = knexBuilder.raw(
            `INSERT INTO ${ONBOARDING_MESSAGES_TABLE_NAME} ("userId", "messageKey", "channel")
             VALUES (?::uuid, ?, ?)
             ON CONFLICT ("userId", "messageKey") DO NOTHING
             RETURNING "id"`,
            [userId, messageKey, channel],
        ).toString();

        return this.db.write.query(queryString).then((response) => response.rows.length > 0);
    }

    /**
     * Accounts that joined `brand` inside the window and have neither a tracked habit nor any pact
     * membership — not even an incoming invite, which has its own reminder.
     */
    getNoHabitCandidates(
        brand: string,
        messageKey: string,
        joinedBefore: Date,
        joinedAfter: Date,
        limit: number,
    ): Promise<INoHabitCandidateRow[]> {
        const queryString = knexBuilder
            .select([
                'u.id as userId',
                'u.email',
                'u.firstName',
                'u.userName',
                'u.isUnclaimed',
                'u.settingsEmailReminders',
                'u.settingsLocale',
            ])
            .from(`${USERS_TABLE_NAME} as u`)
            .whereRaw('u."brandVariations" @> ?::jsonb', [JSON.stringify([{ brand }])])
            .andWhereRaw(`${brandFirstSeenSql} BETWEEN ? AND ?`, [brand, joinedAfter, joinedBefore])
            .andWhere((builder) => {
                builder.where('u.isBot', false).orWhereNull('u.isBot');
            })
            .andWhere((builder) => {
                builder.where('u.settingsIsAccountSoftDeleted', false).orWhereNull('u.settingsIsAccountSoftDeleted');
            })
            .andWhereRaw(`NOT EXISTS (SELECT 1 FROM ${USER_HABITS_TABLE_NAME} AS h WHERE h."userId" = u."id")`)
            .andWhereRaw(`NOT EXISTS (SELECT 1 FROM ${PACT_MEMBERS_TABLE_NAME} AS m WHERE m."userId" = u."id")`)
            .andWhereRaw(notClaimedSql('u."id"'), [messageKey])
            .orderBy('u.createdAt', 'asc')
            .limit(Math.max(1, limit))
            .toString();

        return this.db.read.query(queryString).then((response) => response.rows);
    }

    /**
     * Accounts on `brand` for at least the window, with `minCheckins` or more completed check-ins,
     * and no live partner: no active pact in which someone else is also active. Entitlement is
     * judged by the caller from `accessLevels`, which is where every entitlement check reads it.
     */
    getFounderOfferCandidates(
        brand: string,
        messageKey: string,
        joinedBefore: Date,
        minCheckins: number,
        limit: number,
    ): Promise<IFounderOfferCandidateRow[]> {
        const completedSql = `(SELECT COUNT(*) FROM ${HABIT_CHECKINS_TABLE_NAME} AS c WHERE c."userId" = u."id" AND c."status" = 'completed')`;
        const queryString = knexBuilder
            .select([
                'u.id as userId',
                'u.accessLevels',
                'u.settingsPushMarketing',
                knexBuilder.raw(`${completedSql}::int AS "completedCheckins"`),
            ])
            .from(`${USERS_TABLE_NAME} as u`)
            .whereRaw('u."brandVariations" @> ?::jsonb', [JSON.stringify([{ brand }])])
            .andWhereRaw(`${brandFirstSeenSql} <= ?`, [brand, joinedBefore])
            .andWhere((builder) => {
                builder.where('u.isBot', false).orWhereNull('u.isBot');
            })
            .andWhere((builder) => {
                builder.where('u.settingsIsAccountSoftDeleted', false).orWhereNull('u.settingsIsAccountSoftDeleted');
            })
            .andWhereRaw(`${completedSql} >= ?`, [minCheckins])
            .andWhereRaw(`NOT EXISTS (SELECT 1 FROM ${PACT_MEMBERS_TABLE_NAME} AS mine`
                + ` INNER JOIN ${PACTS_TABLE_NAME} AS p ON p."id" = mine."pactId" AND p."status" = 'active'`
                + ` INNER JOIN ${PACT_MEMBERS_TABLE_NAME} AS other ON other."pactId" = mine."pactId"`
                + ' AND other."userId" <> mine."userId" AND other."status" = \'active\''
                + ' WHERE mine."userId" = u."id" AND mine."status" = \'active\')')
            .andWhereRaw(notClaimedSql('u."id"'), [messageKey])
            .orderBy('u.createdAt', 'asc')
            .limit(Math.max(1, limit))
            .toString();

        return this.db.read.query(queryString).then((response) => response.rows.map((row: any) => ({
            ...row,
            completedCheckins: Number(row.completedCheckins) || 0,
        })));
    }

    /**
     * Invites unanswered inside the window, for the inviter's "they haven't joined yet" prompt.
     * Claimed against the inviter, keyed per seat.
     */
    getUnclaimedSeatsForInviter(
        invitedBefore: Date,
        invitedAfter: Date,
        suffix: string,
        limit: number,
    ): Promise<IUnclaimedSeatRow[]> {
        const queryString = knexBuilder
            .select([
                'pm.id as pactMemberId',
                'pm.pactId',
                'p.creatorUserId',
                'pm.userId as inviteeUserId',
                'g.name as habitGoalName',
            ])
            .from(`${PACT_MEMBERS_TABLE_NAME} as pm`)
            .innerJoin(`${PACTS_TABLE_NAME} as p`, 'p.id', 'pm.pactId')
            .innerJoin(`${HABIT_GOALS_TABLE_NAME} as g`, 'g.id', 'p.habitGoalId')
            .innerJoin(`${USERS_TABLE_NAME} as creator`, 'creator.id', 'p.creatorUserId')
            .where('pm.role', 'partner')
            .andWhere('pm.status', 'pending')
            .whereIn('p.status', ['pending', 'active'])
            .andWhere('pm.invitedAt', '<=', invitedBefore)
            .andWhere('pm.invitedAt', '>=', invitedAfter)
            .andWhere((builder) => {
                builder.where('creator.settingsIsAccountSoftDeleted', false).orWhereNull('creator.settingsIsAccountSoftDeleted');
            })
            .andWhereRaw(notClaimedForSeatSql('p."creatorUserId"', suffix))
            .orderBy('pm.invitedAt', 'asc')
            .limit(Math.max(1, limit))
            .toString();

        return this.db.read.query(queryString).then((response) => response.rows);
    }

    /**
     * Emailed claim-link invites — the invitee was not on the app — still open and inside the
     * window. Claimed against the invitee, keyed per seat and reminder (`suffix`).
     */
    getExpiringEmailSeats(
        now: Date,
        invitedBefore: Date,
        invitedAfter: Date,
        suffix: string,
        limit: number,
    ): Promise<IExpiringSeatRow[]> {
        const queryString = knexBuilder
            .select([
                'pm.id as pactMemberId',
                'pm.pactId',
                'p.creatorUserId',
                'pm.userId as inviteeUserId',
                'g.name as habitGoalName',
                'pm.claimToken',
                'pm.claimCode',
                'pm.claimTokenExpiresAt',
                'invitee.email',
                'invitee.firstName',
                'invitee.isUnclaimed',
                'invitee.settingsEmailInvites',
                'invitee.settingsLocale',
            ])
            .from(`${PACT_MEMBERS_TABLE_NAME} as pm`)
            .innerJoin(`${PACTS_TABLE_NAME} as p`, 'p.id', 'pm.pactId')
            .innerJoin(`${HABIT_GOALS_TABLE_NAME} as g`, 'g.id', 'p.habitGoalId')
            .innerJoin(`${USERS_TABLE_NAME} as invitee`, 'invitee.id', 'pm.userId')
            .where('pm.role', 'partner')
            .andWhere('pm.status', 'pending')
            .andWhere('pm.invitedVia', 'email')
            .whereNotNull('pm.claimToken')
            .andWhere('pm.claimTokenExpiresAt', '>', now)
            .whereIn('p.status', ['pending', 'active'])
            .andWhere('pm.invitedAt', '<=', invitedBefore)
            .andWhere('pm.invitedAt', '>=', invitedAfter)
            .andWhereRaw(notClaimedForSeatSql('pm."userId"', suffix))
            .orderBy('pm.invitedAt', 'asc')
            .limit(Math.max(1, limit))
            .toString();

        return this.db.read.query(queryString).then((response) => response.rows);
    }
}
