import KnexBuilder, { Knex } from 'knex';
import { IConnection } from './connection';
import { PACTS_TABLE_NAME, PACT_MEMBERS_TABLE_NAME, USERS_TABLE_NAME } from './tableNames';

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
     * How many partners this user has ever invited into a pact they created.
     *
     * Backs the solo-habit onboarding gate (`helpers/soloHabitAccess.ts`), which
     * asks "did they do the invite we required of them?" — so it deliberately
     * counts every partner row regardless of its status. A declined or
     * abandoned invite still means the user did their part; only their own
     * creator row is excluded.
     */
    countInvitedByCreator(creatorUserId: string): Promise<number> {
        const queryString = knexBuilder
            .from(`${PACT_MEMBERS_TABLE_NAME} as pm`)
            .innerJoin(`${PACTS_TABLE_NAME} as p`, 'p.id', 'pm.pactId')
            .where('p.creatorUserId', creatorUserId)
            .andWhere('pm.role', 'partner')
            .count('pm.id as count')
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
