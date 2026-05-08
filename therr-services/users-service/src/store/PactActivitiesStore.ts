import KnexBuilder, { Knex } from 'knex';
import { IConnection } from './connection';
import { PACT_ACTIVITIES_TABLE_NAME } from './tableNames';

const knexBuilder: Knex = KnexBuilder({ client: 'pg' });

export type PactActivityType =
    | 'checkin_completed'
    | 'checkin_skipped'
    | 'reaction_added'
    | 'celebration_sent'
    | 'encouragement_sent'
    | 'streak_milestone'
    | 'streak_broken'
    | 'partner_joined'
    | 'pact_started'
    | 'pact_completed';

export interface ICreatePactActivityParams {
    pactId: string;
    userId: string;
    targetUserId?: string;
    activityType: PactActivityType;
    checkinId?: string;
    data?: object;
}

export default class PactActivitiesStore {
    db: IConnection;

    constructor(dbConnection: IConnection) {
        this.db = dbConnection;
    }

    create(params: ICreatePactActivityParams) {
        const queryString = knexBuilder
            .insert({
                ...params,
                data: params.data ? JSON.stringify(params.data) : null,
            })
            .into(PACT_ACTIVITIES_TABLE_NAME)
            .returning('*')
            .toString();

        return this.db.write.query(queryString).then((response) => response.rows[0]);
    }

    getByPactId(pactId: string, limit = 50, offset = 0) {
        const queryString = knexBuilder
            .from(PACT_ACTIVITIES_TABLE_NAME)
            .where({ pactId })
            .orderBy('createdAt', 'desc')
            .limit(limit)
            .offset(offset)
            .toString();

        return this.db.read.query(queryString)
            .then((response) => response.rows);
    }
}
