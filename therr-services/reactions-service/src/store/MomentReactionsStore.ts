import Knex from 'knex';
import { IConnection } from './connection';

const knex: Knex = Knex({ client: 'pg' });

export const MOMENT_REACTIONS_TABLE_NAME = 'main.momentReactions';

export interface ICreateMomentReactionParams {
    momentId: number;
    userId: number;
    userViewCount?: number;
    userHasActivated?: boolean;
    userHasLiked?: boolean;
    userHasSuperLiked?: boolean;
    userHasDisliked?: boolean;
    userHasSuperDisliked?: boolean;
    userLocale?: string;
}

export interface IUpdateMomentReactionConditions {
    momentId: number;
    userId: number;
}

export interface IUpdateMomentReactionParams {
    userViewCount?: number;
    userHasActivated?: boolean;
    userHasLiked?: boolean;
    userHasSuperLiked?: boolean;
    userHasDisliked?: boolean;
    userHasSuperDisliked?: boolean;
    userLocale?: string;
}

export default class MomentReactionsStore {
    db: IConnection;

    constructor(dbConnection) {
        this.db = dbConnection;
    }

    get(conditions: any, momentIds?, limit = 100) {
        const restrictedLimit = (limit) > 1000 ? 1000 : limit;

        let queryString = knex.select('*')
            .from(MOMENT_REACTIONS_TABLE_NAME)
            .where(conditions)
            .limit(restrictedLimit);

        if (momentIds && momentIds.length) {
            queryString = queryString.whereIn('momentId', momentIds);
        }

        return this.db.read.query(queryString.toString()).then((response) => response.rows);
    }

    getByMomentId(conditions: any, limit = 100) {
        // TODO: RSERVE-52 | Remove hard limit and optimize for getting reaction counts
        const restrictedLimit = limit > 1000 ? 1000 : limit;

        const queryString = knex.select('*')
            .from(MOMENT_REACTIONS_TABLE_NAME)
            .where(conditions)
            .limit(restrictedLimit);

        return this.db.read.query(queryString.toString()).then((response) => response.rows);
    }

    create(params: ICreateMomentReactionParams) {
        const queryString = knex.insert(params)
            .into(MOMENT_REACTIONS_TABLE_NAME)
            .returning('*')
            .toString();

        return this.db.write.query(queryString).then((response) => response.rows);
    }

    update(conditions: IUpdateMomentReactionConditions, params: IUpdateMomentReactionParams) {
        const momentReactionParams = {
            ...params,
        };

        const queryString = knex.update(momentReactionParams)
            .into(MOMENT_REACTIONS_TABLE_NAME)
            .where(conditions)
            .returning(['id'])
            .toString();

        return this.db.write.query(queryString).then((response) => response.rows);
    }
}
