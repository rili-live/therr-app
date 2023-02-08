import KnexBuilder, { Knex } from 'knex';
import { IConnection } from './connection';

const knexBuilder: Knex = KnexBuilder({ client: 'pg' });

export const SPACE_INCENTIVES_TABLE_NAME = 'main.spaceIncentives';

export interface ICreateSpaceIncentiveParams {
    spaceId: string;
    incentiveKey: string;
    incentiveValue: number;
    incentiveRewardKey: string;
    incentiveRewardValue: number;
    incentiveCurrencyId: string;
    isActive?: boolean;
    isFeatured?: boolean;
    maxUseCount?: number;
    minUserDataProps?: number;
    region: string;
}

export default class SpacesStore {
    db: IConnection;

    constructor(dbConnection) {
        this.db = dbConnection;
    }

    create(params: ICreateSpaceIncentiveParams) {
        const queryString = knexBuilder.insert(params)
            .into(SPACE_INCENTIVES_TABLE_NAME)
            .returning('*')
            .toString();

        return this.db.write.query(queryString).then((response) => response.rows);
    }

    update(id: string, params: ICreateSpaceIncentiveParams) {
        const queryString = knexBuilder.update(params)
            .into(SPACE_INCENTIVES_TABLE_NAME)
            .where({ id })
            .returning(['id'])
            .toString();

        return this.db.write.query(queryString).then((response) => response.rows);
    }

    delete(id: string) {
        const queryString = knexBuilder.delete()
            .from(SPACE_INCENTIVES_TABLE_NAME)
            .where('id', id)
            .toString();

        return this.db.write.query(queryString).then((response) => response.rows);
    }
}
