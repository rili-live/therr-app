import KnexBuilder, { Knex } from 'knex';
import { achievements } from 'therr-js-utilities/config';
import { IConnection } from './connection';

const knexBuilder: Knex = KnexBuilder({ client: 'pg' });

export const USER_ACHIEVEMENTS_TABLE_NAME = 'main.userAchievements';

export interface ICreateUserAchievementParams {
    userId: string;
    achievementId: string;
    achievementClass: string; // ex. explorer, influencer, etc.
    achievementTier: string; // ex. 1_1, 1_2, 2_1, etc.
    completedAt?: Date;
    progressCount: number;
}

export default class UserAchievementsStore {
    db: IConnection;

    constructor(dbConnection) {
        this.db = dbConnection;
    }

    get(conditions: { achievementId?: string, achievementClass?: string, achievementTier?: string, userId: string }) {
        const queryString = knexBuilder.select()
            .from(USER_ACHIEVEMENTS_TABLE_NAME)
            .where(conditions)
            .toString();

        return this.db.read.query(queryString).then((response) => response.rows);
    }

    getById(id: string) {
        const getAchievementQueryString = knexBuilder.select()
            .from(USER_ACHIEVEMENTS_TABLE_NAME)
            .where({ id })
            .toString();

        return this.db.read.query(getAchievementQueryString).then((response) => response.rows[0]);
    }

    // TODO: This should recursively create userAchievements based on the additional progressCount
    // User transaction, see serverless example
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

    // TODO: This should recursively update/create userAchievements based on the additional progressCount
    // User transaction, see serverless example
    update(id: string, additionalCount: number) {
        // This assumes the record already exists which should be done by the consumer of this request
        return this.getById(id).then((userAchievment) => {
            const countToComplete = achievements[userAchievment.achievementId].countToComplete;
            const params: any = {
                progressCount: userAchievment.progressCount + additionalCount,
                updatedAt: new Date(),
            };

            // If achievement completed
            if (userAchievment.progressCount + additionalCount >= countToComplete) {
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
