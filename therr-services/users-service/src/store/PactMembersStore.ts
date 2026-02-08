import KnexBuilder, { Knex } from 'knex';
import { IConnection } from './connection';
import { PACT_MEMBERS_TABLE_NAME, USERS_TABLE_NAME } from './tableNames';

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
    totalCheckins?: number;
    completedCheckins?: number;
    currentStreak?: number;
    longestStreak?: number;
    completionRate?: number;
    shouldMuteNotifs?: boolean;
    dailyReminderTime?: string;
    celebratePartnerCheckins?: boolean;
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
            .where(`${PACT_MEMBERS_TABLE_NAME}.pactId`, pactId)
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
        });
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

        queryString = queryString
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
