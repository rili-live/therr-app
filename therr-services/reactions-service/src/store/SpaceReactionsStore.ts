import KnexBuilder, { Knex } from 'knex';
import { IConnection } from './connection';

const knexBuilder: Knex = KnexBuilder({ client: 'pg' });

export const SPACE_REACTIONS_TABLE_NAME = 'main.spaceReactions';

export interface ICreateSpaceReactionParams {
    spaceId: string;
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
    visitedAt?: Date;
    lastVisitedAt?: Date;
    visitCount?: number;
}

export interface IUpdateSpaceReactionConditions {
    spaceId?: string;
    userId?: string;
}

export interface IUpdateSpaceReactionParams {
    userViewCount?: number;
    userHasActivated?: boolean;
    userHasLiked?: boolean;
    userHasSuperLiked?: boolean;
    userHasDisliked?: boolean;
    userHasReported?: boolean;
    userHasSuperDisliked?: boolean;
    userLocale?: string;
    rating?: number;
    visitedAt?: Date;
    lastVisitedAt?: Date;
    visitCount?: number;
}

interface IUpdateWhereInConfig {
    columns: string[];
    whereInArray: any[][];
}

export default class SpaceReactionsStore {
    db: IConnection;

    constructor(dbConnection) {
        this.db = dbConnection;
    }

    getCounts(spaceIds: string[], conditions: any, countBy = 'userHasLiked') {
        if (!spaceIds?.length) {
            return Promise.resolve([]);
        }
        let queryString = knexBuilder.count('*', { as: 'count' })
            .select(['spaceId'])
            .from(SPACE_REACTIONS_TABLE_NAME)
            .where({
                ...conditions,
                [countBy]: true,
            })
            .groupBy('spaceId');

        if (spaceIds && spaceIds.length) {
            queryString = queryString.whereIn('spaceId', spaceIds);
        }

        return this.db.read.query(queryString.toString()).then((response) => response.rows);
    }

    get(conditions: any, spaceIds?, filters = { limit: 100, offset: 0, order: 'DESC' }, customs: any = {}) {
        const restrictedLimit = Math.min(filters.limit || 100, 1000);

        let queryString = knexBuilder.select('*')
            .from(SPACE_REACTIONS_TABLE_NAME)
            .where(conditions)
            .limit(restrictedLimit)
            .orderBy('createdAt', filters.order)
            .offset(filters.offset);

        if (customs.withBookmark) {
            queryString = queryString.whereNotNull('userBookmarkCategory');
        }

        if (spaceIds && spaceIds.length) {
            queryString = queryString.whereIn('spaceId', spaceIds);
        }

        return this.db.read.query(queryString.toString()).then((response) => response.rows);
    }

    getBySpaceId(conditions: any, limit = 100) {
        // TODO: RSERVE-52 | Remove hard limit and optimize for getting reaction counts
        const restrictedLimit = limit > 1000 ? 1000 : limit;

        const queryString = knexBuilder.select('*')
            .from(SPACE_REACTIONS_TABLE_NAME)
            .where(conditions)
            .limit(restrictedLimit);

        return this.db.read.query(queryString.toString()).then((response) => response.rows);
    }

    getRatingsBySpaceId(conditions: any, limit = 1000) {
        // TODO: RSERVE-52 | Remove hard limit and optimize for getting reaction counts
        const restrictedLimit = limit > 5000 ? 5000 : limit;

        const queryString = knexBuilder.select(['rating'])
            .from(SPACE_REACTIONS_TABLE_NAME)
            .where(conditions)
            .whereNotNull('rating')
            .limit(restrictedLimit);

        return this.db.read.query(queryString.toString()).then((response) => response.rows);
    }

    getBatchRatings(spaceIds: string[]) {
        if (!spaceIds?.length) {
            return Promise.resolve([]);
        }

        const queryString = knexBuilder
            .select('spaceId')
            .avg('rating as avgRating')
            .count('rating as totalRatings')
            .from(SPACE_REACTIONS_TABLE_NAME)
            .whereIn('spaceId', spaceIds)
            .whereNotNull('rating')
            .groupBy('spaceId');

        return this.db.read.query(queryString.toString()).then((response) => response.rows);
    }

    create(params: ICreateSpaceReactionParams | ICreateSpaceReactionParams[]) {
        const queryString = knexBuilder(SPACE_REACTIONS_TABLE_NAME)
            .insert(params)
            .returning('*')
            .toString();

        return this.db.write.query(queryString).then((response) => response.rows);
    }

    update(conditions: IUpdateSpaceReactionConditions, params: IUpdateSpaceReactionParams, whereIn?: IUpdateWhereInConfig) {
        let queryString = knexBuilder.update({
            ...params,
            updatedAt: new Date(),
            updateCount: knexBuilder.raw('"updateCount" + 1'),
        })
            .into(SPACE_REACTIONS_TABLE_NAME)
            .where(conditions)
            .returning('*');

        if (whereIn && whereIn.whereInArray?.length && whereIn.columns?.length) {
            queryString = queryString.whereIn(whereIn.columns, whereIn.whereInArray);
        }

        return this.db.write.query(queryString.toString()).then((response) => response.rows);
    }

    getVisitedSpaces(userId: string, limit = 100, offset = 0, order = 'DESC') {
        const restrictedLimit = Math.min(limit, 1000);

        const queryString = knexBuilder.select('*')
            .from(SPACE_REACTIONS_TABLE_NAME)
            .where({ userId })
            .whereNotNull('visitedAt')
            .where('visitCount', '>', 0)
            .limit(restrictedLimit)
            .offset(offset)
            .orderBy('lastVisitedAt', order);

        return this.db.read.query(queryString.toString()).then((response) => response.rows);
    }

    getUnreviewedVisitedSpaces(userId: string, lastVisitedBefore: Date, limit = 5) {
        const queryString = knexBuilder.select('*')
            .from(SPACE_REACTIONS_TABLE_NAME)
            .where({ userId })
            .whereNotNull('visitedAt')
            .where('visitCount', '>', 0)
            .whereNull('rating')
            .where('lastVisitedAt', '<', lastVisitedBefore)
            .limit(limit)
            .orderBy('lastVisitedAt', 'DESC');

        return this.db.read.query(queryString.toString()).then((response) => response.rows);
    }

    delete(userId: string) {
        const queryString = knexBuilder.delete()
            .from(SPACE_REACTIONS_TABLE_NAME)
            .where('userId', userId)
            .toString();

        return this.db.write.query(queryString).then((response) => response.rows);
    }
}
