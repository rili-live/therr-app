import KnexBuilder, { Knex } from 'knex';
import { IConnection } from './connection';
import { PACTS_TABLE_NAME, HABIT_GOALS_TABLE_NAME, PACT_MEMBERS_TABLE_NAME } from './tableNames';

const knexBuilder: Knex = KnexBuilder({ client: 'pg' });

export interface ICreatePactParams {
    creatorUserId: string;
    partnerUserId?: string;
    habitGoalId: string;
    pactType?: string;
    durationDays?: number;
    startDate?: Date;
    endDate?: Date;
    consequenceType?: string;
    consequenceDetails?: object;
}

export interface IUpdatePactParams {
    partnerUserId?: string;
    status?: string;
    startDate?: Date;
    endDate?: Date;
    consequenceType?: string;
    consequenceDetails?: object;
    endReason?: string;
    winnerId?: string;
    creatorCompletionRate?: number;
    partnerCompletionRate?: number;
}

export default class PactsStore {
    db: IConnection;

    constructor(dbConnection: IConnection) {
        this.db = dbConnection;
    }

    get(conditions: any, orderBy?: string, limit?: number, offset?: number) {
        let queryString = knexBuilder
            .from(PACTS_TABLE_NAME)
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

    getByIdWithDetails(id: string) {
        const queryString = knexBuilder
            .select([
                `${PACTS_TABLE_NAME}.*`,
                `${HABIT_GOALS_TABLE_NAME}.name as habitGoalName`,
                `${HABIT_GOALS_TABLE_NAME}.emoji as habitGoalEmoji`,
                `${HABIT_GOALS_TABLE_NAME}.category as habitGoalCategory`,
                `${HABIT_GOALS_TABLE_NAME}.frequencyType as habitGoalFrequencyType`,
                `${HABIT_GOALS_TABLE_NAME}.frequencyCount as habitGoalFrequencyCount`,
            ])
            .from(PACTS_TABLE_NAME)
            .leftJoin(HABIT_GOALS_TABLE_NAME, `${PACTS_TABLE_NAME}.habitGoalId`, `${HABIT_GOALS_TABLE_NAME}.id`)
            .where(`${PACTS_TABLE_NAME}.id`, id);

        return this.db.read.query(queryString.toString())
            .then((response) => response.rows[0]);
    }

    getByUserId(userId: string, status?: string, limit?: number, offset?: number) {
        // Membership is the source of truth: a user "is in" a pact if they
        // appear in pact_members. Falls back to creator/partnerUserId on
        // pacts for any historical pact whose member rows are missing.
        let queryString = knexBuilder
            .distinct([
                `${PACTS_TABLE_NAME}.*`,
                `${HABIT_GOALS_TABLE_NAME}.name as habitGoalName`,
                `${HABIT_GOALS_TABLE_NAME}.emoji as habitGoalEmoji`,
                `${HABIT_GOALS_TABLE_NAME}.category as habitGoalCategory`,
            ])
            .from(PACTS_TABLE_NAME)
            .leftJoin(HABIT_GOALS_TABLE_NAME, `${PACTS_TABLE_NAME}.habitGoalId`, `${HABIT_GOALS_TABLE_NAME}.id`)
            .leftJoin(PACT_MEMBERS_TABLE_NAME, function joinMembers() {
                this.on(`${PACT_MEMBERS_TABLE_NAME}.pactId`, '=', `${PACTS_TABLE_NAME}.id`)
                    .andOn(`${PACT_MEMBERS_TABLE_NAME}.userId`, '=', knexBuilder.raw('?', [userId]));
            })
            .where((builder) => {
                builder.where(`${PACTS_TABLE_NAME}.creatorUserId`, userId)
                    .orWhere(`${PACTS_TABLE_NAME}.partnerUserId`, userId)
                    .orWhereNotNull(`${PACT_MEMBERS_TABLE_NAME}.id`);
            })
            .orderBy(`${PACTS_TABLE_NAME}.createdAt`, 'desc');

        if (status) {
            queryString = queryString.andWhere(`${PACTS_TABLE_NAME}.status`, status);
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

    getActivePactsByUserId(userId: string) {
        return this.getByUserId(userId, 'active');
    }

    /**
     * Counts pacts this user has created (not joined as partner) that are
     * still in flight — pending invitation or active. Used to enforce the
     * HABITS free-tier limit so that pacts they're invited to don't count
     * against their cap.
     */
    countOpenByCreator(creatorUserId: string): Promise<number> {
        const queryString = knexBuilder
            .from(PACTS_TABLE_NAME)
            .count('* as count')
            .where('creatorUserId', creatorUserId)
            .whereIn('status', ['pending', 'active'])
            .toString();

        return this.db.read.query(queryString)
            .then((response) => parseInt(response.rows[0]?.count || '0', 10));
    }

    getPendingInvitesForUser(userId: string) {
        // 1:1 invites match on pacts.partnerUserId; group invites match on a
        // pact_members row with role=partner, status=pending. The pact
        // itself may already be 'active' if another invitee accepted first.
        const queryString = knexBuilder
            .distinct([
                `${PACTS_TABLE_NAME}.*`,
                `${HABIT_GOALS_TABLE_NAME}.name as habitGoalName`,
                `${HABIT_GOALS_TABLE_NAME}.emoji as habitGoalEmoji`,
            ])
            .from(PACTS_TABLE_NAME)
            .leftJoin(HABIT_GOALS_TABLE_NAME, `${PACTS_TABLE_NAME}.habitGoalId`, `${HABIT_GOALS_TABLE_NAME}.id`)
            .leftJoin(PACT_MEMBERS_TABLE_NAME, function joinMembers() {
                this.on(`${PACT_MEMBERS_TABLE_NAME}.pactId`, '=', `${PACTS_TABLE_NAME}.id`)
                    .andOn(`${PACT_MEMBERS_TABLE_NAME}.userId`, '=', knexBuilder.raw('?', [userId]));
            })
            .where((builder) => {
                builder.where((b1) => {
                    b1.where(`${PACTS_TABLE_NAME}.partnerUserId`, userId)
                        .andWhere(`${PACTS_TABLE_NAME}.status`, 'pending');
                }).orWhere((b2) => {
                    b2.where(`${PACT_MEMBERS_TABLE_NAME}.userId`, userId)
                        .andWhere(`${PACT_MEMBERS_TABLE_NAME}.role`, 'partner')
                        .andWhere(`${PACT_MEMBERS_TABLE_NAME}.status`, 'pending')
                        .whereIn(`${PACTS_TABLE_NAME}.status`, ['pending', 'active']);
                });
            })
            .orderBy(`${PACTS_TABLE_NAME}.createdAt`, 'desc');

        return this.db.read.query(queryString.toString())
            .then((response) => response.rows);
    }

    getExpiredPacts() {
        const queryString = knexBuilder
            .from(PACTS_TABLE_NAME)
            .where('status', 'active')
            .andWhere('endDate', '<', new Date());

        return this.db.read.query(queryString.toString())
            .then((response) => response.rows);
    }

    create(params: ICreatePactParams) {
        const endDate = params.endDate || (params.startDate
            ? new Date(new Date(params.startDate).getTime() + (params.durationDays || 30) * 24 * 60 * 60 * 1000)
            : null);

        const queryString = knexBuilder
            .insert({
                ...params,
                pactType: params.pactType || 'accountability',
                durationDays: params.durationDays || 30,
                endDate,
                consequenceDetails: params.consequenceDetails ? JSON.stringify(params.consequenceDetails) : null,
            })
            .into(PACTS_TABLE_NAME)
            .returning('*')
            .toString();

        return this.db.write.query(queryString).then((response) => response.rows[0]);
    }

    update(id: string, params: IUpdatePactParams) {
        const modifiedParams: any = { ...params };

        if (params.consequenceDetails) {
            modifiedParams.consequenceDetails = JSON.stringify(params.consequenceDetails);
        }

        const queryString = knexBuilder
            .where({ id })
            .update({
                ...modifiedParams,
                updatedAt: new Date(),
            })
            .into(PACTS_TABLE_NAME)
            .returning('*')
            .toString();

        return this.db.write.query(queryString).then((response) => response.rows[0]);
    }

    activate(id: string, startDate?: Date) {
        const start = startDate || new Date();
        const pactPromise = this.getById(id);

        return pactPromise.then((pact) => {
            if (!pact) {
                return null;
            }

            const endDate = new Date(start.getTime() + pact.durationDays * 24 * 60 * 60 * 1000);

            return this.update(id, {
                status: 'active',
                startDate: start,
                endDate,
            });
        });
    }

    complete(id: string, winnerId?: string, creatorCompletionRate?: number, partnerCompletionRate?: number) {
        return this.update(id, {
            status: 'completed',
            endReason: 'completed',
            winnerId,
            creatorCompletionRate,
            partnerCompletionRate,
        });
    }

    abandon(id: string, abandoningUserId: string, isCreator: boolean) {
        return this.update(id, {
            status: 'abandoned',
            endReason: isCreator ? 'abandoned_creator' : 'abandoned_partner',
        });
    }

    expire(id: string) {
        return this.update(id, {
            status: 'expired',
            endReason: 'expired',
        });
    }

    delete(id: string, userId: string) {
        // Only allow deletion of pending pacts by creator
        const queryString = knexBuilder
            .where({ id, creatorUserId: userId, status: 'pending' })
            .delete()
            .into(PACTS_TABLE_NAME)
            .returning('*')
            .toString();

        return this.db.write.query(queryString).then((response) => response.rows[0]);
    }
}
