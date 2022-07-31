import KnexBuilder, { Knex } from 'knex';
import { achievements } from 'therr-js-utilities/config';
import { IConnection } from './connection';

const knexBuilder: Knex = KnexBuilder({ client: 'pg' });

export const USER_ACHIEVEMENTS_TABLE_NAME = 'main.userAchievements';

export interface ICreateUserAchievementParams {
    userId: string;
    achievementId: string;
    progressCount: string;
}

export default class UserAchievementsStore {
    db: IConnection;

    constructor(dbConnection) {
        this.db = dbConnection;
    }

    get(conditions: { achievementId?: string, userId: string }) {
        const queryString = knexBuilder.select()
            .from(USER_ACHIEVEMENTS_TABLE_NAME)
            .where(conditions)
            .toString();

        return this.db.read.query(queryString).then((response) => response.rows);
    }

    create(params: ICreateUserAchievementParams) {
        const sanitizedParams = {
            ...params,
        };
        const queryString = knexBuilder.insert(sanitizedParams)
            .into(USER_ACHIEVEMENTS_TABLE_NAME)
            .returning('*')
            .toString();

        return this.db.write.query(queryString).then((response) => response.rows);
    }

    update(id: string, additionalCount: number) {
        // This assumes the record already exists which should be done by the consumer of this request
        const getAchievementQueryString = knexBuilder.select()
            .from(USER_ACHIEVEMENTS_TABLE_NAME)
            .where({ id })
            .toString();

        return this.db.read.query(getAchievementQueryString).then((response) => {
            const userAchievment = response.rows[0];
            const countToComplete = achievements[userAchievment.achievementId].countToComplete;
            const params: any = {
                progressCount: response.rows[0].progressCount + additionalCount,
                updatedAt: new Date(),
            };

            // If achievement completed
            if (response.rows[0].progressCount + additionalCount >= countToComplete) {
                params.completedAt = new Date();
            }

            const queryString = knexBuilder.where({ id })
                .update(params)
                .into(USER_ACHIEVEMENTS_TABLE_NAME)
                .returning('*')
                .toString();

            return this.db.write.query(queryString).then((updateResponse) => updateResponse.rows);
        });
    }
}
