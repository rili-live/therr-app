import KnexBuilder, { Knex } from 'knex';
import { IConnection } from './connection';
import { PACTS_TABLE_NAME, HABIT_GOALS_TABLE_NAME } from './tableNames';

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
        let queryString = knexBuilder
            .select([
                `${PACTS_TABLE_NAME}.*`,
                `${HABIT_GOALS_TABLE_NAME}.name as habitGoalName`,
                `${HABIT_GOALS_TABLE_NAME}.emoji as habitGoalEmoji`,
                `${HABIT_GOALS_TABLE_NAME}.category as habitGoalCategory`,
            ])
            .from(PACTS_TABLE_NAME)
            .leftJoin(HABIT_GOALS_TABLE_NAME, `${PACTS_TABLE_NAME}.habitGoalId`, `${HABIT_GOALS_TABLE_NAME}.id`)
            .where((builder) => {
                builder.where(`${PACTS_TABLE_NAME}.creatorUserId`, userId)
                    .orWhere(`${PACTS_TABLE_NAME}.partnerUserId`, userId);
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

    getPendingInvitesForUser(userId: string) {
        const queryString = knexBuilder
            .select([
                `${PACTS_TABLE_NAME}.*`,
                `${HABIT_GOALS_TABLE_NAME}.name as habitGoalName`,
                `${HABIT_GOALS_TABLE_NAME}.emoji as habitGoalEmoji`,
            ])
            .from(PACTS_TABLE_NAME)
            .leftJoin(HABIT_GOALS_TABLE_NAME, `${PACTS_TABLE_NAME}.habitGoalId`, `${HABIT_GOALS_TABLE_NAME}.id`)
            .where(`${PACTS_TABLE_NAME}.partnerUserId`, userId)
            .andWhere(`${PACTS_TABLE_NAME}.status`, 'pending')
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
