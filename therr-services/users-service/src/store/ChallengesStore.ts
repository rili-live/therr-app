import KnexBuilder, { Knex } from 'knex';
import { IConnection } from './connection';
import {
    CHALLENGES_TABLE_NAME,
    CHALLENGE_MEMBERS_TABLE_NAME,
    HABIT_CHECKINS_TABLE_NAME,
    HABIT_GOALS_TABLE_NAME,
    USERS_TABLE_NAME,
} from './tableNames';

const knexBuilder: Knex = KnexBuilder({ client: 'pg' });

export type ChallengeStatus = 'active' | 'ended' | 'cancelled';
export type ChallengeMemberStatus = 'active' | 'left';

export interface IChallengeRow {
    id: string;
    creatorUserId: string;
    habitGoalId: string;
    title: string | null;
    joinToken: string;
    startDate: string;
    endDate: string;
    maxMembers: number;
    status: ChallengeStatus;
    createdAt: Date;
    updatedAt: Date;
}

/** A challenge with the goal and creator fields every reader of it renders. */
export interface IChallengeDetailRow extends IChallengeRow {
    goalName: string;
    goalEmoji: string | null;
    goalAmountUnit: string | null;
    creatorUserName: string;
    creatorFirstName: string | null;
    activeMemberCount: number;
}

export interface IChallengeMemberRow {
    id: string;
    challengeId: string;
    userId: string;
    status: ChallengeMemberStatus;
    joinedAt: Date;
    createdAt: Date;
    updatedAt: Date;
}

export interface IChallengeStandingRow {
    userId: string;
    userName: string;
    firstName: string | null;
    joinedAt: Date;
    /** Distinct days with a completed check-in on the challenge's goal, inside its window. */
    checkinDays: number;
    /** Sum of recorded amounts inside the window; 0 for a yes/no habit. */
    totalAmount: number;
    lastCheckinDate: string | null;
}

export interface ICreateChallengeParams {
    creatorUserId: string;
    habitGoalId: string;
    title?: string | null;
    joinToken: string;
    startDate: string;
    endDate: string;
    maxMembers?: number;
}

// Dates are read back as 'YYYY-MM-DD' strings: node-postgres turns a DATE into a JS Date at
// server-local midnight, which is a different calendar day for every reader west of the server.
const DETAIL_COLUMNS = [
    'c.id',
    'c.creatorUserId',
    'c.habitGoalId',
    'c.title',
    'c.joinToken',
    knexBuilder.raw('to_char(c."startDate", \'YYYY-MM-DD\') as "startDate"'),
    knexBuilder.raw('to_char(c."endDate", \'YYYY-MM-DD\') as "endDate"'),
    'c.maxMembers',
    'c.status',
    'c.createdAt',
    'c.updatedAt',
    'g.name as goalName',
    'g.emoji as goalEmoji',
    'g.amountUnit as goalAmountUnit',
    'u.userName as creatorUserName',
    'u.firstName as creatorFirstName',
    knexBuilder.raw(`(
        SELECT COUNT(*)::int FROM ${CHALLENGE_MEMBERS_TABLE_NAME} cm
        WHERE cm."challengeId" = c.id AND cm.status = 'active'
    ) as "activeMemberCount"`),
];

/**
 * Join-by-link challenges. See migration 20261023000001_habits.challenges.js for why a
 * challenge is its own object rather than a large pact.
 */
export default class ChallengesStore {
    db: IConnection;

    constructor(dbConnection: IConnection) {
        this.db = dbConnection;
    }

    /** Returns the id only; read the challenge back with `getDetailById` for its string dates. */
    create(params: ICreateChallengeParams): Promise<Pick<IChallengeRow, 'id'>> {
        const queryString = knexBuilder
            .insert(params)
            .into(CHALLENGES_TABLE_NAME)
            .returning('id')
            .toString();

        return this.db.write.query(queryString).then((response) => response.rows[0]);
    }

    private getDetail(where: Record<string, string>): Promise<IChallengeDetailRow | undefined> {
        const queryString = knexBuilder
            .select(DETAIL_COLUMNS)
            .from(`${CHALLENGES_TABLE_NAME} as c`)
            .innerJoin(`${HABIT_GOALS_TABLE_NAME} as g`, 'g.id', 'c.habitGoalId')
            .innerJoin(`${USERS_TABLE_NAME} as u`, 'u.id', 'c.creatorUserId')
            .where(where)
            .toString();

        return this.db.read.query(queryString).then((response) => response.rows[0]);
    }

    getDetailById(id: string): Promise<IChallengeDetailRow | undefined> {
        return this.getDetail({ 'c.id': id });
    }

    getDetailByToken(joinToken: string): Promise<IChallengeDetailRow | undefined> {
        return this.getDetail({ 'c.joinToken': joinToken });
    }

    /** Challenges the user is an active member of (including ones they created), newest first. */
    getDetailsForMember(userId: string, limit = 50): Promise<IChallengeDetailRow[]> {
        const queryString = knexBuilder
            .select(DETAIL_COLUMNS)
            .from(`${CHALLENGES_TABLE_NAME} as c`)
            .innerJoin(`${HABIT_GOALS_TABLE_NAME} as g`, 'g.id', 'c.habitGoalId')
            .innerJoin(`${USERS_TABLE_NAME} as u`, 'u.id', 'c.creatorUserId')
            .innerJoin(`${CHALLENGE_MEMBERS_TABLE_NAME} as me`, 'me.challengeId', 'c.id')
            .where('me.userId', userId)
            .andWhere('me.status', 'active')
            .whereNot('c.status', 'cancelled')
            .orderBy('c.startDate', 'desc')
            .limit(limit)
            .toString();

        return this.db.read.query(queryString).then((response) => response.rows);
    }

    /**
     * The running challenge on this habit that the user is already on the board of, created by
     * them or joined from someone's link. One habit gets one board: a second challenge would split
     * the same friends across two scoreboards counting the same check-ins.
     */
    getRunningForMemberAndGoal(userId: string, habitGoalId: string, today: string): Promise<IChallengeDetailRow | undefined> {
        const queryString = knexBuilder
            .select(DETAIL_COLUMNS)
            .from(`${CHALLENGES_TABLE_NAME} as c`)
            .innerJoin(`${HABIT_GOALS_TABLE_NAME} as g`, 'g.id', 'c.habitGoalId')
            .innerJoin(`${USERS_TABLE_NAME} as u`, 'u.id', 'c.creatorUserId')
            .innerJoin(`${CHALLENGE_MEMBERS_TABLE_NAME} as me`, 'me.challengeId', 'c.id')
            .where('me.userId', userId)
            .andWhere('me.status', 'active')
            .andWhere('c.habitGoalId', habitGoalId)
            .andWhere('c.status', 'active')
            .andWhere('c.endDate', '>=', today)
            .orderBy('c.startDate', 'desc')
            .limit(1)
            .toString();

        return this.db.read.query(queryString).then((response) => response.rows[0]);
    }

    /** Running challenges this user created — the anti-spam cap reads it. */
    countActiveCreatedBy(creatorUserId: string, today: string): Promise<number> {
        const queryString = knexBuilder
            .from(CHALLENGES_TABLE_NAME)
            .where({ creatorUserId, status: 'active' })
            .andWhere('endDate', '>=', today)
            .count('id as count')
            .toString();

        return this.db.read.query(queryString)
            .then((response) => parseInt(response.rows[0]?.count ?? '0', 10));
    }

    getMember(challengeId: string, userId: string): Promise<IChallengeMemberRow | undefined> {
        const queryString = knexBuilder
            .from(CHALLENGE_MEMBERS_TABLE_NAME)
            .where({ challengeId, userId })
            .toString();

        return this.db.read.query(queryString).then((response) => response.rows[0]);
    }

    /**
     * Add a member, or revive one who left. Returns the row and whether this call is what made
     * them an active member, so a double-tapped join (or a retry) notifies the creator once.
     */
    upsertActiveMember(challengeId: string, userId: string): Promise<{ member: IChallengeMemberRow; wasJustJoined: boolean }> {
        const queryString = knexBuilder.raw(
            `INSERT INTO ${CHALLENGE_MEMBERS_TABLE_NAME} ("challengeId", "userId", status)
            VALUES (?, ?, 'active')
            ON CONFLICT ("challengeId", "userId") DO UPDATE
                SET status = 'active', "joinedAt" = now(), "updatedAt" = now()
                WHERE ${CHALLENGE_MEMBERS_TABLE_NAME}.status <> 'active'
            RETURNING *`,
            [challengeId, userId],
        ).toString();

        return this.db.write.query(queryString).then(async (response) => {
            if (response.rows[0]) {
                return { member: response.rows[0], wasJustJoined: true };
            }
            // Already active: the conditional DO UPDATE wrote nothing and returned nothing.
            const existing = await this.getMember(challengeId, userId);
            return { member: existing as IChallengeMemberRow, wasJustJoined: false };
        });
    }

    setMemberStatus(challengeId: string, userId: string, status: ChallengeMemberStatus) {
        const queryString = knexBuilder
            .update({ status, updatedAt: new Date() })
            .into(CHALLENGE_MEMBERS_TABLE_NAME)
            .where({ challengeId, userId })
            .returning('*')
            .toString();

        return this.db.write.query(queryString).then((response) => response.rows[0]);
    }

    setStatus(id: string, status: ChallengeStatus) {
        const queryString = knexBuilder
            .update({ status, updatedAt: new Date() })
            .into(CHALLENGES_TABLE_NAME)
            .where({ id })
            .returning('*')
            .toString();

        return this.db.write.query(queryString).then((response) => response.rows[0]);
    }

    /**
     * Every active member's tally inside the challenge window, unsorted — ranking is the
     * caller's rule (`utilities/challengeStandings.ts`), not the query's.
     *
     * Counts *distinct days* rather than rows so a check-in edited or re-saved on the same day
     * never counts twice, and reads `scheduledDate`, the user's own calendar day, which is what
     * the window's dates are in.
     */
    getStandings(challenge: Pick<IChallengeRow, 'id' | 'habitGoalId' | 'startDate' | 'endDate'>): Promise<IChallengeStandingRow[]> {
        const queryString = knexBuilder.raw(
            `SELECT
                m."userId",
                u."userName",
                u."firstName",
                m."joinedAt",
                COUNT(DISTINCT ch."scheduledDate")::int AS "checkinDays",
                COALESCE(SUM(ch."savedAmount"), 0)::float AS "totalAmount",
                to_char(MAX(ch."scheduledDate"), 'YYYY-MM-DD') AS "lastCheckinDate"
            FROM ${CHALLENGE_MEMBERS_TABLE_NAME} m
            INNER JOIN ${USERS_TABLE_NAME} u ON u.id = m."userId"
            LEFT JOIN ${HABIT_CHECKINS_TABLE_NAME} ch
                ON ch."userId" = m."userId"
                AND ch."habitGoalId" = ?
                AND ch.status = 'completed'
                AND ch."scheduledDate" >= ?::date
                AND ch."scheduledDate" <= ?::date
            WHERE m."challengeId" = ? AND m.status = 'active'
            GROUP BY m."userId", u."userName", u."firstName", m."joinedAt"`,
            [challenge.habitGoalId, challenge.startDate, challenge.endDate, challenge.id],
        ).toString();

        return this.db.read.query(queryString).then((response) => response.rows.map((row: any) => ({
            ...row,
            checkinDays: Number(row.checkinDays) || 0,
            totalAmount: Number(row.totalAmount) || 0,
        })));
    }
}
