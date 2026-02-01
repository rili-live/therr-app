import KnexBuilder, { Knex } from 'knex';
import { IConnection } from './connection';
import { STREAKS_TABLE_NAME, STREAK_HISTORY_TABLE_NAME } from './tableNames';

const knexBuilder: Knex = KnexBuilder({ client: 'pg' });

export interface ICreateStreakParams {
    userId: string;
    habitGoalId: string;
    pactId?: string;
    gracePeriodDays?: number;
}

export interface IUpdateStreakParams {
    currentStreak?: number;
    currentStreakStartDate?: string;
    lastCompletedDate?: string;
    longestStreak?: number;
    longestStreakStartDate?: string;
    longestStreakEndDate?: string;
    graceDaysUsed?: number;
    isActive?: boolean;
}

export interface ICreateStreakHistoryParams {
    streakId: string;
    userId: string;
    checkinId?: string;
    eventType: string;
    eventDate: string;
    streakBefore: number;
    streakAfter: number;
    milestoneReached?: number;
}

export default class StreaksStore {
    db: IConnection;

    constructor(dbConnection: IConnection) {
        this.db = dbConnection;
    }

    // Streaks methods
    get(conditions: any, orderBy?: string, limit?: number, offset?: number) {
        let queryString = knexBuilder
            .from(STREAKS_TABLE_NAME)
            .where(conditions);

        if (orderBy) {
            queryString = queryString.orderBy(orderBy, 'desc');
        }

        if (limit) {
            queryString = queryString.limit(limit);
        }

        if (offset) {
            queryString = queryString.offset(offset);
        }

        return this.db.read.query(queryString.toString())
            .then((response) => response.rows);
    }

    getById(id: string) {
        return this.get({ id }).then((results) => results[0]);
    }

    getByUserAndHabit(userId: string, habitGoalId: string) {
        return this.get({ userId, habitGoalId }).then((results) => results[0]);
    }

    getByUserId(userId: string, isActive?: boolean) {
        const conditions: any = { userId };
        if (isActive !== undefined) {
            conditions.isActive = isActive;
        }
        return this.get(conditions, 'currentStreak');
    }

    getActiveStreaksByUserId(userId: string) {
        return this.getByUserId(userId, true);
    }

    getByPactId(pactId: string) {
        return this.get({ pactId }, 'currentStreak');
    }

    getTopStreaks(limit = 10) {
        const queryString = knexBuilder
            .from(STREAKS_TABLE_NAME)
            .where('isActive', true)
            .andWhere('currentStreak', '>', 0)
            .orderBy('currentStreak', 'desc')
            .limit(limit);

        return this.db.read.query(queryString.toString())
            .then((response) => response.rows);
    }

    create(params: ICreateStreakParams) {
        const queryString = knexBuilder
            .insert({
                ...params,
                currentStreak: 0,
                longestStreak: 0,
                gracePeriodDays: params.gracePeriodDays || 0,
                graceDaysUsed: 0,
                isActive: true,
            })
            .into(STREAKS_TABLE_NAME)
            .returning('*')
            .toString();

        return this.db.write.query(queryString).then((response) => response.rows[0]);
    }

    getOrCreate(userId: string, habitGoalId: string, pactId?: string) {
        return this.getByUserAndHabit(userId, habitGoalId)
            .then((existing) => {
                if (existing) {
                    return existing;
                }
                return this.create({ userId, habitGoalId, pactId });
            });
    }

    update(id: string, params: IUpdateStreakParams) {
        const queryString = knexBuilder
            .where({ id })
            .update({
                ...params,
                updatedAt: new Date(),
            })
            .into(STREAKS_TABLE_NAME)
            .returning('*')
            .toString();

        return this.db.write.query(queryString).then((response) => response.rows[0]);
    }

    incrementStreak(id: string, completionDate: string) {
        return this.getById(id).then((streak) => {
            if (!streak) {
                return null;
            }

            const newStreak = streak.currentStreak + 1;
            const isNewRecord = newStreak > streak.longestStreak;
            const updates: IUpdateStreakParams = {
                currentStreak: newStreak,
                lastCompletedDate: completionDate,
            };

            // If this is the first day of a new streak, set the start date
            if (streak.currentStreak === 0) {
                updates.currentStreakStartDate = completionDate;
            }

            // Update longest streak if we beat the record
            if (isNewRecord) {
                updates.longestStreak = newStreak;
                if (!streak.longestStreakStartDate) {
                    updates.longestStreakStartDate = streak.currentStreakStartDate || completionDate;
                }
                updates.longestStreakEndDate = completionDate;
            }

            return this.update(id, updates);
        });
    }

    resetStreak(id: string) {
        return this.getById(id).then((streak) => {
            if (!streak) {
                return null;
            }

            // If current streak was the longest, record its end date
            const updates: IUpdateStreakParams = {
                currentStreak: 0,
                currentStreakStartDate: undefined,
                graceDaysUsed: 0,
            };

            if (streak.currentStreak === streak.longestStreak && streak.currentStreak > 0) {
                updates.longestStreakEndDate = streak.lastCompletedDate;
            }

            return this.update(id, updates);
        });
    }

    useGraceDay(id: string) {
        const queryString = knexBuilder
            .into(STREAKS_TABLE_NAME)
            .where({ id })
            .increment('graceDaysUsed', 1)
            .update({ updatedAt: new Date() })
            .returning('*')
            .toString();

        return this.db.write.query(queryString).then((response) => response.rows[0]);
    }

    deactivate(id: string) {
        return this.update(id, { isActive: false });
    }

    // Streak History methods
    getHistory(conditions: any, limit?: number, offset?: number) {
        let queryString = knexBuilder
            .from(STREAK_HISTORY_TABLE_NAME)
            .where(conditions)
            .orderBy('eventDate', 'desc');

        if (limit) {
            queryString = queryString.limit(limit);
        }

        if (offset) {
            queryString = queryString.offset(offset);
        }

        return this.db.read.query(queryString.toString())
            .then((response) => response.rows);
    }

    getHistoryByStreakId(streakId: string, limit?: number) {
        return this.getHistory({ streakId }, limit);
    }

    getHistoryByUserId(userId: string, limit?: number) {
        return this.getHistory({ userId }, limit);
    }

    getMilestoneHistory(userId: string) {
        const queryString = knexBuilder
            .from(STREAK_HISTORY_TABLE_NAME)
            .where({ userId, eventType: 'milestone_reached' })
            .whereNotNull('milestoneReached')
            .orderBy('milestoneReached', 'desc');

        return this.db.read.query(queryString.toString())
            .then((response) => response.rows);
    }

    createHistoryEntry(params: ICreateStreakHistoryParams) {
        const queryString = knexBuilder
            .insert(params)
            .into(STREAK_HISTORY_TABLE_NAME)
            .returning('*')
            .toString();

        return this.db.write.query(queryString).then((response) => response.rows[0]);
    }

    recordCompletion(streakId: string, userId: string, checkinId: string, eventDate: string, streakBefore: number, streakAfter: number) {
        return this.createHistoryEntry({
            streakId,
            userId,
            checkinId,
            eventType: 'completed',
            eventDate,
            streakBefore,
            streakAfter,
        });
    }

    recordMissed(streakId: string, userId: string, eventDate: string, streakBefore: number) {
        return this.createHistoryEntry({
            streakId,
            userId,
            eventType: 'missed',
            eventDate,
            streakBefore,
            streakAfter: 0,
        });
    }

    recordGraceUsed(streakId: string, userId: string, eventDate: string, currentStreak: number) {
        return this.createHistoryEntry({
            streakId,
            userId,
            eventType: 'grace_used',
            eventDate,
            streakBefore: currentStreak,
            streakAfter: currentStreak,
        });
    }

    recordMilestone(streakId: string, userId: string, checkinId: string, eventDate: string, streakBefore: number, milestoneReached: number) {
        return this.createHistoryEntry({
            streakId,
            userId,
            checkinId,
            eventType: 'milestone_reached',
            eventDate,
            streakBefore,
            streakAfter: milestoneReached,
            milestoneReached,
        });
    }
}
