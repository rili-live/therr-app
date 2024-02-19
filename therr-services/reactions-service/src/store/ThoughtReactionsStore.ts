import KnexBuilder, { Knex } from 'knex';
import { IConnection } from './connection';

const knexBuilder: Knex = KnexBuilder({ client: 'pg' });

export const THOUGHT_REACTIONS_TABLE_NAME = 'main.thoughtReactions';

export interface ICreateThoughtReactionParams {
    thoughtId: string;
    userId: string;
    userViewCount?: number;
    userHasActivated?: boolean;
    userHasLiked?: boolean;
    userHasSuperLiked?: boolean;
    userHasDisliked?: boolean;
    userHasReported?: boolean;
    userHasSuperDisliked?: boolean;
    userLocale?: string;
}

export interface IUpdateThoughtReactionConditions {
    thoughtId?: string;
    userId?: string;
}

export interface IUpdateThoughtReactionParams {
    userViewCount?: number;
    userHasActivated?: boolean;
    userHasLiked?: boolean;
    userHasSuperLiked?: boolean;
    userHasDisliked?: boolean;
    userHasReported?: boolean;
    userHasSuperDisliked?: boolean;
    userLocale?: string;
}

interface IUpdateWhereInConfig {
    columns: string[];
    whereInArray: any[][];
}

export default class ThoughtReactionsStore {
    db: IConnection;

    constructor(dbConnection) {
        this.db = dbConnection;
    }

    getCounts(thoughtIds: string[], conditions: any, countBy = 'userHasLiked') {
        if (!thoughtIds?.length) {
            return Promise.resolve([]);
        }
        let queryString = knexBuilder.count('*', { as: 'count' })
            .select(['thoughtId'])
            .from(THOUGHT_REACTIONS_TABLE_NAME)
            .where({
                ...conditions,
                [countBy]: true,
            })
            .groupBy('thoughtId');

        if (thoughtIds && thoughtIds.length) {
            queryString = queryString.whereIn('thoughtId', thoughtIds);
        }

        return this.db.read.query(queryString.toString()).then((response) => response.rows);
    }

    get(conditions: any, thoughtIds?, filters = { limit: 100, offset: 0, order: 'DESC' }, customs: any = {}) {
        const restrictedLimit = Math.min(filters.limit || 100, 1000);

        let queryString = knexBuilder.select('*')
            .from(THOUGHT_REACTIONS_TABLE_NAME)
            .where(conditions)
            .limit(restrictedLimit)
            .orderBy('createdAt', filters.order)
            .offset(filters.offset);

        if (customs.withBookmark) {
            queryString = queryString.whereNotNull('userBookmarkCategory');
        }

        if (thoughtIds && thoughtIds.length) {
            queryString = queryString.whereIn('thoughtId', thoughtIds);
        }

        return this.db.read.query(queryString.toString()).then((response) => response.rows);
    }

    getByThoughtId(conditions: any, limit = 100) {
        // TODO: RSERVE-52 | Remove hard limit and optimize for getting reaction counts
        const restrictedLimit = Math.min(limit || 100, 1000);

        const queryString = knexBuilder.select('*')
            .from(THOUGHT_REACTIONS_TABLE_NAME)
            .where(conditions)
            .limit(restrictedLimit);

        return this.db.read.query(queryString.toString()).then((response) => response.rows);
    }

    create(params: ICreateThoughtReactionParams | ICreateThoughtReactionParams[]) {
        const queryString = knexBuilder(THOUGHT_REACTIONS_TABLE_NAME)
            .insert(params)
            .returning('*')
            .toString();

        return this.db.write.query(queryString).then((response) => response.rows);
    }

    update(conditions: IUpdateThoughtReactionConditions, params: IUpdateThoughtReactionParams, whereIn?: IUpdateWhereInConfig) {
        let queryString = knexBuilder.update({
            ...params,
            updatedAt: new Date(),
        })
            .into(THOUGHT_REACTIONS_TABLE_NAME)
            .where(conditions)
            .returning('*');

        if (whereIn && whereIn.whereInArray?.length) {
            queryString = queryString.whereIn(whereIn.columns, whereIn.whereInArray);
        }

        return this.db.write.query(queryString.toString()).then((response) => response.rows);
    }

    delete(userId: string) {
        const queryString = knexBuilder.delete()
            .from(THOUGHT_REACTIONS_TABLE_NAME)
            .where('userId', userId)
            .toString();

        return this.db.write.query(queryString).then((response) => response.rows);
    }
}
