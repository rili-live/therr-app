import KnexBuilder, { Knex } from 'knex';
import { IConnection } from './connection';
import { IDENTITY_PROGRESS_TABLE_NAME, HABIT_GOALS_TABLE_NAME } from './tableNames';

const knexBuilder: Knex = KnexBuilder({ client: 'pg' });

export interface IIdentityProgressRow {
    id: string;
    userId: string;
    habitGoalId: string;
    pactId?: string;
    identityLabel?: string;
    identityLabelSetAt?: Date;
    stage: number;
    stageEnteredAt: Date;
    highestStage: number;
    votesCast: number;
    comebackCount: number;
    reflectionCount: number;
    partnerAffirmationCount: number;
    selfConceptScore?: number;
    selfConceptScoredAt?: Date;
    firstVoteDate?: string;
    lastVoteDate?: string;
    identityConfirmedAt?: Date;
    createdAt: Date;
    updatedAt: Date;
}

export interface IUpdateIdentityProgressParams {
    pactId?: string;
    identityLabel?: string;
    identityLabelSetAt?: Date;
    stage?: number;
    stageEnteredAt?: Date;
    highestStage?: number;
    votesCast?: number;
    comebackCount?: number;
    reflectionCount?: number;
    partnerAffirmationCount?: number;
    selfConceptScore?: number;
    selfConceptScoredAt?: Date;
    firstVoteDate?: string;
    lastVoteDate?: string;
    identityConfirmedAt?: Date;
}

/**
 * Identity progression state per (user, habit goal).
 *
 * Nothing in this store decrements. `recordVote` and the counter bumps are all
 * additive, and `applyStage` refuses to lower a stage. That is a product rule, not
 * an oversight: a lapse costs a streak, and it must not cost an identity.
 */
export default class IdentityProgressStore {
    db: IConnection;

    constructor(dbConnection: IConnection) {
        this.db = dbConnection;
    }

    get(conditions: any, orderBy?: string, limit?: number) {
        let queryString = knexBuilder
            .from(IDENTITY_PROGRESS_TABLE_NAME)
            .where(conditions);

        if (orderBy) {
            queryString = queryString.orderBy(orderBy, 'desc');
        }

        if (limit) {
            queryString = queryString.limit(limit);
        }

        return this.db.read.query(queryString.toString())
            .then((response) => response.rows);
    }

    getById(id: string) {
        return this.get({ id }).then((results) => results[0]);
    }

    getByUserAndHabit(userId: string, habitGoalId: string) {
        return this.get({ userId, habitGoalId }).then((results) => results[0]);
    }

    /**
     * Every identity the user is building, newest activity first, with the habit's
     * display fields joined in for the dashboard list.
     */
    getByUserId(userId: string) {
        const queryString = knexBuilder
            .select([
                `${IDENTITY_PROGRESS_TABLE_NAME}.*`,
                `${HABIT_GOALS_TABLE_NAME}.name as habitGoalName`,
                `${HABIT_GOALS_TABLE_NAME}.emoji as habitGoalEmoji`,
            ])
            .from(IDENTITY_PROGRESS_TABLE_NAME)
            .leftJoin(
                HABIT_GOALS_TABLE_NAME,
                `${IDENTITY_PROGRESS_TABLE_NAME}.habitGoalId`,
                `${HABIT_GOALS_TABLE_NAME}.id`,
            )
            .where(`${IDENTITY_PROGRESS_TABLE_NAME}.userId`, userId)
            .orderBy(`${IDENTITY_PROGRESS_TABLE_NAME}.lastVoteDate`, 'desc', 'last')
            .toString();

        return this.db.read.query(queryString).then((response) => response.rows);
    }

    /**
     * Upsert on the (userId, habitGoalId) unique constraint, so two concurrent
     * check-ins for the same habit can't race into duplicate rows. Only `pactId`
     * is merged — every other column belongs to whichever row already exists.
     */
    getOrCreate(userId: string, habitGoalId: string, pactId?: string) {
        const queryString = knexBuilder
            .insert({ userId, habitGoalId, pactId })
            .into(IDENTITY_PROGRESS_TABLE_NAME)
            .onConflict(['userId', 'habitGoalId'])
            .merge({ updatedAt: new Date(), ...(pactId ? { pactId } : {}) })
            .returning('*')
            .toString();

        return this.db.write.query(queryString).then((response) => response.rows[0]);
    }

    update(id: string, params: IUpdateIdentityProgressParams) {
        const queryString = knexBuilder
            .where({ id })
            .update({
                ...params,
                updatedAt: new Date(),
            })
            .into(IDENTITY_PROGRESS_TABLE_NAME)
            .returning('*')
            .toString();

        return this.db.write.query(queryString).then((response) => response.rows[0]);
    }

    setIdentityLabel(id: string, identityLabel: string) {
        return this.update(id, { identityLabel, identityLabelSetAt: new Date() });
    }

    /**
     * Record one completed check-in as a vote for this identity.
     *
     * `firstVoteDate` uses COALESCE so it is written once and never moves — the
     * elapsed-time rung depends on it. The increment is done in SQL rather than
     * read-modify-write so simultaneous check-ins across devices both count.
     */
    recordVote(id: string, voteDate: string) {
        const queryString = knexBuilder(IDENTITY_PROGRESS_TABLE_NAME)
            .where({ id })
            .update({
                votesCast: knexBuilder.raw('?? + 1', ['votesCast']),
                firstVoteDate: knexBuilder.raw('COALESCE(??, ?)', ['firstVoteDate', voteDate]),
                lastVoteDate: voteDate,
                updatedAt: new Date(),
            })
            .returning('*')
            .toString();

        return this.db.write.query(queryString).then((response) => response.rows[0]);
    }

    incrementCounter(id: string, column: 'comebackCount' | 'reflectionCount' | 'partnerAffirmationCount') {
        const queryString = knexBuilder(IDENTITY_PROGRESS_TABLE_NAME)
            .where({ id })
            .update({
                [column]: knexBuilder.raw('?? + 1', [column]),
                updatedAt: new Date(),
            })
            .returning('*')
            .toString();

        return this.db.write.query(queryString).then((response) => response.rows[0]);
    }

    recordSelfConceptScore(id: string, selfConceptScore: number) {
        return this.update(id, { selfConceptScore, selfConceptScoredAt: new Date() });
    }

    /**
     * Move to a newly evaluated stage. A no-op when the stage is unchanged or
     * lower — the guard lives here so no caller can accidentally demote a user.
     * Returns null when nothing changed, which callers use to decide whether a
     * stage-up notification is warranted.
     */
    applyStage(row: IIdentityProgressRow, nextStage: number) {
        if (nextStage <= row.stage) {
            return Promise.resolve(null);
        }

        return this.update(row.id, {
            stage: nextStage,
            stageEnteredAt: new Date(),
            highestStage: Math.max(nextStage, row.highestStage || 0),
        });
    }

    markIdentityConfirmed(id: string) {
        return this.update(id, { identityConfirmedAt: new Date() });
    }
}
