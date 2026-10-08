import KnexBuilder, { Knex } from 'knex';
import { IHabitPledge } from 'therr-js-utilities/constants';
import { IConnection } from './connection';
import {
    HABIT_GOALS_TABLE_NAME,
    PACTS_TABLE_NAME,
    PACT_MEMBERS_TABLE_NAME,
    USERS_TABLE_NAME,
} from './tableNames';

const knexBuilder: Knex = KnexBuilder({ client: 'pg' });

export interface ICreatePactMemberParams {
    pactId: string;
    userId: string;
    role: 'creator' | 'partner';
    status?: string;
    dailyReminderTime?: string;
}

export interface IUpdatePactMemberParams {
    status?: string;
    joinedAt?: Date;
    leftAt?: Date;
    nudgedAt?: Date | null;
    totalCheckins?: number;
    completedCheckins?: number;
    currentStreak?: number;
    longestStreak?: number;
    completionRate?: number;
    shouldMuteNotifs?: boolean;
    dailyReminderTime?: string;
    celebratePartnerCheckins?: boolean;
    claimToken?: string | null;
    claimCode?: string | null;
    claimTokenExpiresAt?: Date | null;
    invitedVia?: string | null;
}

/**
 * One pledged member of a running pact, as the weekly pledge verdict reads it. See
 * `getPledgedMembersForVerdict`.
 */
export interface IPledgedPactMemberRow {
    pactMemberId: string;
    pactId: string;
    userId: string;
    habitGoalId: string;
    pledge: IHabitPledge;
    pactStartDate: Date | string | null;
    settingsTimezone?: string | null;
}

/**
 * One unanswered invite to someone already on the brand, as the invite reminder reads it. See
 * `getUnansweredInvitesForReminder`.
 */
export interface IUnansweredInviteRow {
    pactMemberId: string;
    pactId: string;
    inviteeUserId: string;
    habitGoalName: string | null;
    creatorUserId: string;
}

export interface IPactInviteClaim {
    token?: string;
    code?: string;
}

export default class PactMembersStore {
    db: IConnection;

    constructor(dbConnection: IConnection) {
        this.db = dbConnection;
    }

    get(conditions: any, orderBy?: string, limit?: number, offset?: number) {
        let queryString = knexBuilder
            .from(PACT_MEMBERS_TABLE_NAME)
            .where(conditions);

        if (orderBy) {
            queryString = queryString.orderBy(orderBy, 'desc');
        }

        if (limit) {
            queryString = queryString.limit(limit);
        }

        if (offset) {
            queryString = queryString.offset(offset);
        }

        return this.db.read.query(queryString.toString())
            .then((response) => response.rows);
    }

    getById(id: string) {
        return this.get({ id }).then((results) => results[0]);
    }

    getByPactId(pactId: string) {
        return this.getByPactIds([pactId]);
    }

    /**
     * Members for one or many pacts, hydrated with the display fields the
     * client needs to name a partner. List endpoints pass the whole page in
     * one call rather than fanning out per pact (N+1); getByPactId is the
     * single-pact case of the same query.
     */
    getByPactIds(pactIds: string[]) {
        if (!pactIds.length) {
            return Promise.resolve([]);
        }

        const queryString = knexBuilder
            .select([
                `${PACT_MEMBERS_TABLE_NAME}.*`,
                `${USERS_TABLE_NAME}.userName`,
                `${USERS_TABLE_NAME}.firstName`,
                `${USERS_TABLE_NAME}.lastName`,
                `${USERS_TABLE_NAME}.media as userMedia`,
            ])
            .from(PACT_MEMBERS_TABLE_NAME)
            .leftJoin(USERS_TABLE_NAME, `${PACT_MEMBERS_TABLE_NAME}.userId`, `${USERS_TABLE_NAME}.id`)
            .whereIn(`${PACT_MEMBERS_TABLE_NAME}.pactId`, pactIds)
            .orderBy(`${PACT_MEMBERS_TABLE_NAME}.role`, 'asc');

        return this.db.read.query(queryString.toString())
            .then((response) => response.rows);
    }

    getByPactAndUser(pactId: string, userId: string) {
        return this.get({ pactId, userId }).then((results) => results[0]);
    }

    /**
     * How many members are actively participating in a pact right now — the denominator for
     * the majority threshold and the floor checks for member removal / solo continuation.
     * Counts `active` only: `pending` invitees have not joined, and `left`/`removed`/`completed`
     * members are no longer carrying the pact day to day.
     */
    countActiveByPactId(pactId: string): Promise<number> {
        const queryString = knexBuilder
            .from(PACT_MEMBERS_TABLE_NAME)
            .where({ pactId, status: 'active' })
            .count('id as count')
            .toString();

        return this.db.read.query(queryString)
            .then((response) => parseInt(response.rows[0]?.count ?? '0', 10));
    }

    getByUserId(userId: string, status?: string) {
        const conditions: any = { userId };
        if (status) {
            conditions.status = status;
        }
        return this.get(conditions, 'createdAt');
    }

    getActiveMembersByUserId(userId: string) {
        return this.getByUserId(userId, 'active');
    }

    /**
     * How many *distinct people* this user has ever invited into a pact they
     * created.
     *
     * Backs the solo-habit unlock (`helpers/soloHabitAccess.ts`), which asks
     * "have they invited the friends we asked them to?" — so it deliberately
     * counts every partner regardless of invite status. A declined or abandoned
     * invite still means the user did their part; only their own creator row is
     * excluded.
     *
     * Distinct is load-bearing, not tidiness. This used to count partner rows,
     * which was indistinguishable from counting people while the threshold was
     * one. Now that it takes several to unlock, counting rows would let the same
     * friend be invited to three pacts and satisfy "invite three people" without
     * a single extra person hearing about the app — which is the entire point of
     * the requirement.
     */
    countDistinctInvitedByCreator(creatorUserId: string): Promise<number> {
        const queryString = knexBuilder
            .from(`${PACT_MEMBERS_TABLE_NAME} as pm`)
            .innerJoin(`${PACTS_TABLE_NAME} as p`, 'p.id', 'pm.pactId')
            .where('p.creatorUserId', creatorUserId)
            .andWhere('pm.role', 'partner')
            .countDistinct('pm.userId as count')
            .toString();

        return this.db.read.query(queryString)
            .then((response) => parseInt(response.rows[0]?.count ?? '0', 10));
    }

    create(params: ICreatePactMemberParams) {
        const queryString = knexBuilder
            .insert({
                ...params,
                status: params.status || 'pending',
            })
            .into(PACT_MEMBERS_TABLE_NAME)
            .returning('*')
            .toString();

        return this.db.write.query(queryString).then((response) => response.rows[0]);
    }

    createBulk(members: ICreatePactMemberParams[]) {
        const queryString = knexBuilder
            .insert(members.map((m) => ({
                ...m,
                status: m.status || 'pending',
            })))
            .into(PACT_MEMBERS_TABLE_NAME)
            .returning('*')
            .toString();

        return this.db.write.query(queryString).then((response) => response.rows);
    }

    update(id: string, params: IUpdatePactMemberParams) {
        const queryString = knexBuilder
            .where({ id })
            .update({
                ...params,
                updatedAt: new Date(),
            })
            .into(PACT_MEMBERS_TABLE_NAME)
            .returning('*')
            .toString();

        return this.db.write.query(queryString).then((response) => response.rows[0]);
    }

    updateByPactAndUser(pactId: string, userId: string, params: IUpdatePactMemberParams) {
        const queryString = knexBuilder
            .where({ pactId, userId })
            .update({
                ...params,
                updatedAt: new Date(),
            })
            .into(PACT_MEMBERS_TABLE_NAME)
            .returning('*')
            .toString();

        return this.db.write.query(queryString).then((response) => response.rows[0]);
    }

    activate(pactId: string, userId: string) {
        return this.updateByPactAndUser(pactId, userId, {
            status: 'active',
            joinedAt: new Date(),
            claimToken: null,
            claimCode: null,
            claimTokenExpiresAt: null,
        });
    }

    markNudged(pactId: string, partnerId: string) {
        return this.updateByPactAndUser(pactId, partnerId, {
            nudgedAt: new Date(),
        });
    }

    /**
     * Re-points a pending pact_members row to a freshly-registered user when
     * a Therr connection signs up on Habits with a different user id than the
     * one we recorded at invite time. Caller is responsible for ensuring the
     * member is still pending and unexpired.
     */
    rebindUserId(memberId: string, userId: string) {
        const queryString = knexBuilder
            .where({ id: memberId })
            .update({ userId, updatedAt: new Date() })
            .into(PACT_MEMBERS_TABLE_NAME)
            .returning('*')
            .toString();

        return this.db.write.query(queryString).then((response) => response.rows[0]);
    }

    findByClaim(claim: IPactInviteClaim) {
        if (!claim.token && !claim.code) {
            return Promise.resolve(undefined);
        }

        const queryString = knexBuilder
            .from(PACT_MEMBERS_TABLE_NAME)
            .where((builder) => {
                if (claim.token) {
                    builder.orWhere('claimToken', claim.token);
                }
                if (claim.code) {
                    builder.orWhere('claimCode', claim.code);
                }
            })
            .limit(1)
            .toString();

        return this.db.read.query(queryString).then((response) => response.rows[0]);
    }

    leave(pactId: string, userId: string) {
        return this.updateByPactAndUser(pactId, userId, {
            status: 'left',
            leftAt: new Date(),
        });
    }

    /**
     * Creator removed this member from the pact. Distinct from `leave` (the member left of
     * their own accord) only by status — `removed` vs `left` — so the two are told apart in
     * history and in the renewal invitee filter, which carries neither forward.
     */
    remove(pactId: string, userId: string) {
        return this.updateByPactAndUser(pactId, userId, {
            status: 'removed',
            leftAt: new Date(),
        });
    }

    incrementCheckinStats(id: string, completed: boolean, newStreak?: number) {
        let queryString = knexBuilder
            .into(PACT_MEMBERS_TABLE_NAME)
            .where({ id })
            .increment('totalCheckins', 1);

        if (completed) {
            queryString = queryString.increment('completedCheckins', 1);
        }

        const updates: any = { updatedAt: new Date() };
        if (newStreak !== undefined) {
            updates.currentStreak = newStreak;
        }

        queryString = (queryString as any)
            .update(updates)
            .returning('*');

        return this.db.write.query(queryString.toString()).then((response) => {
            const member = response.rows[0];
            // Update longest streak if current exceeds it
            if (member && member.currentStreak > member.longestStreak) {
                return this.update(member.id, { longestStreak: member.currentStreak });
            }
            return member;
        });
    }

    updateCompletionRate(id: string) {
        // Calculate and update completion rate
        const completionRateCalc = 'CASE WHEN "totalCheckins" > 0 '
            + 'THEN ROUND(("completedCheckins"::numeric / "totalCheckins"::numeric) * 100, 2) '
            + 'ELSE 0 END';
        const queryString = knexBuilder
            .from(PACT_MEMBERS_TABLE_NAME)
            .where({ id })
            .update({
                completionRate: knexBuilder.raw(completionRateCalc),
                updatedAt: new Date(),
            })
            .returning('*')
            .toString();

        return this.db.write.query(queryString).then((response) => response.rows[0]);
    }

    /**
     * Set or clear one member's own pledge. `null` clears it. Written as a JSON string
     * because the builder does not serialize objects into a jsonb literal itself — the same
     * reason PactsStore stringifies `consequenceDetails`.
     */
    setPledge(pactId: string, userId: string, pledge: IHabitPledge | null) {
        const queryString = knexBuilder
            .where({ pactId, userId })
            .update({
                pledge: pledge ? JSON.stringify(pledge) : null,
                updatedAt: new Date(),
            })
            .into(PACT_MEMBERS_TABLE_NAME)
            .returning('*')
            .toString();

        return this.db.write.query(queryString).then((response) => response.rows[0]);
    }

    /**
     * Every member holding a pledge on a pact that is still running, with the zone their week
     * is judged in. The weekly pledge verdict's whole population.
     *
     * Small by construction — only pledged members of active pacts — so it is read in one
     * query rather than paged. `limit` bounds it anyway, and the caller reports hitting it.
     *
     * Both statuses are required: an `active` member of an `active` pact. A member who left,
     * or a pact the expiry sweep closed, is not held to a pledge on a week they were no longer
     * in. Soft-deleted accounts are excluded for the same reason the daily-streak sweep
     * excludes them.
     */
    getPledgedMembersForVerdict(limit: number): Promise<IPledgedPactMemberRow[]> {
        const queryString = knexBuilder
            .select([
                'pm.id as pactMemberId',
                'pm.pactId',
                'pm.userId',
                'pm.pledge',
                'p.habitGoalId',
                'p.startDate as pactStartDate',
                'u.settingsTimezone',
            ])
            .from(`${PACT_MEMBERS_TABLE_NAME} as pm`)
            .innerJoin(`${PACTS_TABLE_NAME} as p`, 'p.id', 'pm.pactId')
            .innerJoin(`${USERS_TABLE_NAME} as u`, 'u.id', 'pm.userId')
            .whereNotNull('pm.pledge')
            .andWhere('pm.status', 'active')
            .andWhere('p.status', 'active')
            .andWhere((builder) => {
                builder.where('u.settingsIsAccountSoftDeleted', false)
                    .orWhereNull('u.settingsIsAccountSoftDeleted');
            })
            .orderBy('pm.id', 'asc')
            .limit(Math.max(1, limit))
            .toString();

        return this.db.read.query(queryString).then((response) => response.rows);
    }

    /**
     * Invites still waiting on someone who already uses `brand`: the invite reminder's
     * population (handlers/helpers/pactInviteReminderDigest.ts).
     *
     * "Uses the brand" is the same test `dispatchPactInvitation` makes when it decides an invite
     * goes out as a push rather than an email/SMS claim link, so these are exactly the invitees
     * whose only prompt was that one push. A pending seat on an `active` pact counts too: a
     * group pact goes active on its first acceptance and the other invitees can still accept.
     *
     * Invitees who turned invite pushes off, and soft-deleted accounts, are left out here rather
     * than filtered by the caller, so a capped read is not spent on rows that can never send.
     */
    getUnansweredInvitesForReminder(
        brand: string,
        invitedBefore: Date,
        invitedAfter: Date,
        limit: number,
    ): Promise<IUnansweredInviteRow[]> {
        const queryString = knexBuilder
            .select([
                'pm.id as pactMemberId',
                'pm.pactId',
                'pm.userId as inviteeUserId',
                'g.name as habitGoalName',
                'p.creatorUserId',
            ])
            .from(`${PACT_MEMBERS_TABLE_NAME} as pm`)
            .innerJoin(`${PACTS_TABLE_NAME} as p`, 'p.id', 'pm.pactId')
            .innerJoin(`${HABIT_GOALS_TABLE_NAME} as g`, 'g.id', 'p.habitGoalId')
            .innerJoin(`${USERS_TABLE_NAME} as invitee`, 'invitee.id', 'pm.userId')
            .where('pm.role', 'partner')
            .andWhere('pm.status', 'pending')
            .whereIn('p.status', ['pending', 'active'])
            .andWhere('pm.invitedAt', '<=', invitedBefore)
            .andWhere('pm.invitedAt', '>=', invitedAfter)
            .andWhereRaw('invitee."brandVariations" @> ?::jsonb', [JSON.stringify([{ brand }])])
            .andWhere((builder) => {
                builder.where('invitee.settingsPushInvites', true)
                    .orWhereNull('invitee.settingsPushInvites');
            })
            .andWhere((builder) => {
                builder.where('invitee.settingsIsAccountSoftDeleted', false)
                    .orWhereNull('invitee.settingsIsAccountSoftDeleted');
            })
            .orderBy('pm.invitedAt', 'asc')
            .limit(Math.max(1, limit))
            .toString();

        return this.db.read.query(queryString).then((response) => response.rows);
    }

    /**
     * Whether an invite can still be accepted: the seat is pending and its pact has not ended.
     * Read at send time by the notification queue, because hours can pass between queueing a
     * reminder and the worker draining it.
     */
    isInviteOpen(pactMemberId: string): Promise<boolean> {
        const queryString = knexBuilder
            .select('pm.id')
            .from(`${PACT_MEMBERS_TABLE_NAME} as pm`)
            .innerJoin(`${PACTS_TABLE_NAME} as p`, 'p.id', 'pm.pactId')
            .where('pm.id', pactMemberId)
            .andWhere('pm.status', 'pending')
            .whereIn('p.status', ['pending', 'active'])
            .toString();

        return this.db.read.query(queryString).then((response) => response.rows.length > 0);
    }

    delete(id: string) {
        const queryString = knexBuilder
            .where({ id })
            .delete()
            .into(PACT_MEMBERS_TABLE_NAME)
            .returning('*')
            .toString();

        return this.db.write.query(queryString).then((response) => response.rows[0]);
    }
}
