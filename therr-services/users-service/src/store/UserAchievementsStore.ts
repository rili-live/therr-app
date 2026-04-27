import KnexBuilder, { Knex } from 'knex';
// eslint-disable-next-line import/extensions, import/no-unresolved
import { IAchievement } from 'therr-js-utilities/config';
// eslint-disable-next-line import/extensions, import/no-unresolved
import { withBrandOnInsert } from 'therr-js-utilities/db';
import BrandScopedStore, { BrandValue } from './BrandScopedStore';
import { IConnection } from './connection';

const knexBuilder: Knex = KnexBuilder({ client: 'pg' });

// eslint-disable-next-line no-restricted-syntax -- this is the sanctioned canonical reference
export const USER_ACHIEVEMENTS_TABLE_NAME = 'main.userAchievements';

export interface ICreateUserAchievementParams {
    userId: string;
    achievementId: string;
    achievementClass: string; // ex. explorer, influencer, etc.
    achievementTier: string; // ex. 1_1, 1_2, 2_1, etc.
    completedAt?: Date;
    progressCount: number;
    unclaimedRewardPts?: number;
}

type IResultAction = 'incomplete'
    | 'achievement-tier-completed'
    | 'achievement-tier-already-complete'
    | 'created-first-of-tier'
    | 'created-next-of-tier'
    | 'updated-in-progress-tier';

export interface IDBAchievement extends ICreateUserAchievementParams {
    id: string;
    createdAt: Date;
    updatedAt: Date;
}

export interface ICreateOrUpdateResponse {
    created: IDBAchievement[];
    updated: IDBAchievement[];
    action: IResultAction;
}

export default class UserAchievementsStore extends BrandScopedStore {
    constructor(dbConnection: IConnection) {
        // Brand-scoped per docs/NICHE_APP_DATABASE_GUIDELINES.md.
        // Stays in 'shadow' for one release cycle; flip to 'enforce' once shadow logs are clean.
        super(dbConnection, USER_ACHIEVEMENTS_TABLE_NAME, 'shadow');
    }

    get(brand: BrandValue, conditions: { id?: string, achievementId?: string, achievementClass?: string, achievementTier?: string, userId: string }) {
        const queryString = this.scopedQuery(brand)
            .select()
            .where(conditions)
            .toString();

        return this.db.read.query(queryString).then((response) => response.rows);
    }

    getById(brand: BrandValue, id: string) {
        const getAchievementQueryString = this.scopedQuery(brand)
            .select()
            .where({ id })
            .toString();

        return this.db.read.query(getAchievementQueryString).then((response) => response.rows[0]);
    }

    create(brand: BrandValue, paramsList: ICreateUserAchievementParams[]) {
        this.assertBrand(brand);
        if (!paramsList.length) {
            return Promise.resolve([] as IDBAchievement[]);
        }
        const stamped = paramsList.map((row) => withBrandOnInsert(row as unknown as Record<string, unknown>, brand));
        const queryString = knexBuilder.insert(stamped)
            .into(USER_ACHIEVEMENTS_TABLE_NAME)
            .returning('*')
            .toString();

        return this.db.write.query(queryString).then((response) => response.rows);
    }

    updateAndCreateConsecutive(
        brand: BrandValue,
        commonProps: {
            userId: string;
            achievementClass: string;
            achievementTier: string;
        },
        totalProgressCount: number,
        tierAchievements: (IAchievement & { id: string })[],
        latestAch: IDBAchievement | undefined,
    ): Promise<ICreateOrUpdateResponse> {
        let updateAchievementPromise: Promise<any[]> = Promise.resolve([]);
        const achievementsToCreate: ICreateUserAchievementParams[] = [];
        const currentAchievementIndex = !latestAch ? 0 : tierAchievements.findIndex((ach) => ach.id === latestAch.achievementId);
        let achievementsIndex = currentAchievementIndex;
        let remainingCount = totalProgressCount;

        let outcomeTag: IResultAction = 'incomplete';

        if (latestAch) {
            if (latestAch.completedAt) {
                achievementsIndex += 1;
                outcomeTag = 'created-next-of-tier';
            } else {
                outcomeTag = 'updated-in-progress-tier';
                const completedAt = (latestAch.progressCount + remainingCount) >= tierAchievements[achievementsIndex].countToComplete ? new Date() : undefined;
                const unclaimedRewardPts = completedAt ? tierAchievements[achievementsIndex].pointReward : 0;
                updateAchievementPromise = this.update(brand, latestAch.id, {
                    progressCount: Math.min(latestAch.progressCount + remainingCount, tierAchievements[achievementsIndex].countToComplete),
                    completedAt,
                    unclaimedRewardPts,
                });
                remainingCount = Math.max(0, (latestAch.progressCount + remainingCount) - tierAchievements[achievementsIndex].countToComplete);
                if (completedAt) {
                    achievementsIndex += 1;
                }
            }
        } else {
            outcomeTag = 'created-first-of-tier';
        }

        while (remainingCount > 0 && tierAchievements[achievementsIndex]) {
            const completedAt = remainingCount >= tierAchievements[achievementsIndex].countToComplete ? new Date() : undefined;
            const unclaimedRewardPts = completedAt ? tierAchievements[achievementsIndex].pointReward : 0;

            const achievement = {
                userId: commonProps.userId,
                achievementId: tierAchievements[achievementsIndex].id,
                achievementClass: commonProps.achievementClass,
                achievementTier: commonProps.achievementTier,
                progressCount: Math.min(remainingCount, tierAchievements[achievementsIndex].countToComplete),
                completedAt,
                unclaimedRewardPts,
            };
            if (achievementsIndex >= tierAchievements.length - 1) {
                outcomeTag = 'achievement-tier-completed';
            }
            achievementsToCreate.push(achievement);
            remainingCount -= tierAchievements[achievementsIndex].countToComplete;
            remainingCount = Math.max(0, remainingCount - tierAchievements[achievementsIndex].countToComplete);
            achievementsIndex += 1;
        }

        return Promise.all([this.create(brand, achievementsToCreate), updateAchievementPromise]).then(([created, updated]) => {
            if (!created.length && !updated.length) {
                outcomeTag = 'achievement-tier-already-complete';
            }

            return {
                created,
                updated,
                action: outcomeTag,
            };
        });
    }

    update(brand: BrandValue, id: string, params: any) {
        const queryString = this.scopedUpdate(brand, { id })
            .update(params)
            .returning('*')
            .toString();

        return this.db.write.query(queryString).then((updateResponse) => updateResponse.rows);
    }
}
