import KnexBuilder, { Knex } from 'knex';
import { IConnection } from './connection';

const knexBuilder: Knex = KnexBuilder({ client: 'pg' });

export const EVENT_REACTIONS_TABLE_NAME = 'main.eventReactions';

export interface ICreateEventReactionParams {
    eventId: string;
    userId: string;
    userViewCount?: number;
    userHasActivated?: boolean;
    userHasLiked?: boolean;
    userHasSuperLiked?: boolean;
    userHasDisliked?: boolean;
    userHasReported?: boolean;
    userHasSuperDisliked?: boolean;
    userLocale?: string;
    rating?: number;
}

export interface IUpdateEventReactionConditions {
    eventId?: string;
    userId?: string;
}

export interface IUpdateEventReactionParams {
    userViewCount?: number;
    userHasActivated?: boolean;
    userHasLiked?: boolean;
    userHasSuperLiked?: boolean;
    userHasDisliked?: boolean;
    userHasReported?: boolean;
    userHasSuperDisliked?: boolean;
    userLocale?: string;
    rating?: number;
}

interface IUpdateWhereInConfig {
    columns: string[];
    whereInArray: any[][];
}

export default class EventReactionsStore {
    db: IConnection;

    constructor(dbConnection) {
        this.db = dbConnection;
    }

    getCounts(eventIds: string[], conditions: any, countBy = 'userHasLiked') {
        if (!eventIds?.length) {
            return Promise.resolve([]);
        }
        let queryString = knexBuilder.count('*', { as: 'count' })
            .select(['eventId'])
            .from(EVENT_REACTIONS_TABLE_NAME)
            .where({
                ...conditions,
                [countBy]: true,
            })
            .groupBy('eventId');

        if (eventIds && eventIds.length) {
            queryString = queryString.whereIn('eventId', eventIds);
        }

        return this.db.read.query(queryString.toString()).then((response) => response.rows);
    }

    get(conditions: any, eventIds?, filters = { limit: 100, offset: 0, order: 'DESC' }, customs: any = {}) {
        const restrictedLimit = Math.min(filters.limit || 100, 1000);

        let queryString = knexBuilder.select('*')
            .from(EVENT_REACTIONS_TABLE_NAME)
            .where(conditions)
            .limit(restrictedLimit)
            .orderBy('createdAt', filters.order)
            .offset(filters.offset);

        if (customs.withBookmark) {
            queryString = queryString.whereNotNull('userBookmarkCategory');
        }

        if (eventIds && eventIds.length) {
            queryString = queryString.whereIn('eventId', eventIds);
        }

        return this.db.read.query(queryString.toString()).then((response) => response.rows);
    }

    getByEventId(conditions: any, limit = 100) {
        // TODO: RSERVE-52 | Remove hard limit and optimize for getting reaction counts
        const restrictedLimit = limit > 1000 ? 1000 : limit;

        const queryString = knexBuilder.select('*')
            .from(EVENT_REACTIONS_TABLE_NAME)
            .where(conditions)
            .limit(restrictedLimit);

        return this.db.read.query(queryString.toString()).then((response) => response.rows);
    }

    getRatingsByEventId(conditions: any, limit = 1000) {
        // TODO: RSERVE-52 | Remove hard limit and optimize for getting reaction counts
        const restrictedLimit = limit > 5000 ? 5000 : limit;

        const queryString = knexBuilder.select(['rating'])
            .from(EVENT_REACTIONS_TABLE_NAME)
            .where(conditions)
            .whereNotNull('rating')
            .limit(restrictedLimit);

        return this.db.read.query(queryString.toString()).then((response) => response.rows);
    }

    create(params: ICreateEventReactionParams | ICreateEventReactionParams[]) {
        const queryString = knexBuilder(EVENT_REACTIONS_TABLE_NAME)
            .insert(params)
            .returning('*')
            .toString();

        return this.db.write.query(queryString).then((response) => response.rows);
    }

    update(conditions: IUpdateEventReactionConditions, params: IUpdateEventReactionParams, whereIn?: IUpdateWhereInConfig) {
        let queryString = knexBuilder.update({
            ...params,
            updatedAt: new Date(),
            updateCount: knexBuilder.raw('"updateCount" + 1'),
        })
            .into(EVENT_REACTIONS_TABLE_NAME)
            .where(conditions)
            .returning('*');

        if (whereIn && whereIn.whereInArray?.length && whereIn.columns?.length) {
            queryString = queryString.whereIn(whereIn.columns, whereIn.whereInArray);
        }

        return this.db.write.query(queryString.toString()).then((response) => response.rows);
    }

    delete(userId: string) {
        const queryString = knexBuilder.delete()
            .from(EVENT_REACTIONS_TABLE_NAME)
            .where('userId', userId)
            .toString();

        return this.db.write.query(queryString).then((response) => response.rows);
    }
}
