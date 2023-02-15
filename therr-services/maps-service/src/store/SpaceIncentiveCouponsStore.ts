import KnexBuilder, { Knex } from 'knex';
import { IConnection } from './connection';

const knexBuilder: Knex = KnexBuilder({ client: 'pg' });

export const SPACE_INCENTIVE_COUPONS_TABLE_NAME = 'main.spaceIncentiveCoupons';

export interface ICreateSpaceIncentiveCouponParams {
    spaceIncentiveId: string;
    userId: string;
    useCount: number;
    region: string;
}

export default class SpacesStore {
    db: IConnection;

    constructor(dbConnection) {
        this.db = dbConnection;
    }

    get(userId: string, spaceIncentiveId: string) {
        const queryString = knexBuilder.select()
            .from(SPACE_INCENTIVE_COUPONS_TABLE_NAME)
            .where({
                userId,
                spaceIncentiveId,
            })
            .toString();

        return this.db.read.query(queryString).then((response) => response.rows);
    }

    upsert(params: ICreateSpaceIncentiveCouponParams) {
        const queryString = knexBuilder.insert(params)
            .into(SPACE_INCENTIVE_COUPONS_TABLE_NAME)
            .returning('*')
            .onConflict(['spaceIncentiveId', 'userId'])
            .merge({
                useCount: knexBuilder.raw('?? + ?', [`${SPACE_INCENTIVE_COUPONS_TABLE_NAME}.useCount`, 1]),
            })
            .toString();

        return this.db.write.query(queryString).then((response) => response.rows);
    }

    update(spaceIncentiveId: string, params: ICreateSpaceIncentiveCouponParams) {
        const queryString = knexBuilder.update(params)
            .into(SPACE_INCENTIVE_COUPONS_TABLE_NAME)
            .where({ spaceIncentiveId })
            .returning(['spaceIncentiveId'])
            .toString();

        return this.db.write.query(queryString).then((response) => response.rows);
    }

    delete(id: string) {
        const queryString = knexBuilder.delete()
            .from(SPACE_INCENTIVE_COUPONS_TABLE_NAME)
            .where('id', id)
            .toString();

        return this.db.write.query(queryString).then((response) => response.rows);
    }
}
