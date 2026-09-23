/* eslint-disable class-methods-use-this */
import axios from 'axios';
import { HabitGoalType, SavingsTargetScope } from 'therr-js-utilities/constants';

/**
 * The savings target on a `savings_goal` habit. Ignored by the server for any other
 * `goalType`.
 *
 * `null` and absent mean different things on every field, and the distinction travels
 * all the way to the column: an absent key leaves the stored value alone, which is what
 * makes a partial update (renaming a habit) safe, while an explicit `null` clears it.
 * Never send `null` to mean "unchanged".
 */
export interface ISavingsTargetBody {
    /** Major units. `null` is an open-ended savings habit — a total, with no finish line. */
    targetAmount?: number | null;
    /** ISO 4217, display only; nothing converts between currencies. */
    currencyCode?: string | null;
    /** Whether `targetAmount` is each member's own goal or the group's combined one. */
    savingsTargetScope?: SavingsTargetScope | null;
}

export interface ICreateHabitGoalBody extends ISavingsTargetBody {
    name: string;
    description?: string;
    category?: string;
    emoji?: string;
    goalType?: HabitGoalType;
    frequencyType?: string;
    frequencyCount?: number;
    targetDaysOfWeek?: number[];
    isPublic?: boolean;
}

export interface IUpdateHabitGoalBody extends ISavingsTargetBody {
    name?: string;
    description?: string;
    category?: string;
    emoji?: string;
    goalType?: HabitGoalType;
    frequencyType?: string;
    frequencyCount?: number;
    targetDaysOfWeek?: number[];
    isPublic?: boolean;
}

class HabitGoalsService {
    create = (data: ICreateHabitGoalBody) => axios({
        method: 'post',
        url: '/users-service/habits/goals',
        data,
    });

    get = (id: string) => axios({
        method: 'get',
        url: `/users-service/habits/goals/${id}`,
    });

    getUserGoals = (limit?: number, offset?: number) => {
        const params = new URLSearchParams();
        if (limit) params.append('limit', limit.toString());
        if (offset) params.append('offset', offset.toString());
        const queryString = params.toString() ? `?${params.toString()}` : '';

        return axios({
            method: 'get',
            url: `/users-service/habits/goals${queryString}`,
        });
    };

    getTemplates = (category?: string, limit?: number, offset?: number) => {
        const params = new URLSearchParams();
        if (category) params.append('category', category);
        if (limit) params.append('limit', limit.toString());
        if (offset) params.append('offset', offset.toString());
        const queryString = params.toString() ? `?${params.toString()}` : '';

        return axios({
            method: 'get',
            url: `/users-service/habits/goals/templates${queryString}`,
        });
    };

    getPublicGoals = (category?: string, limit?: number, offset?: number) => {
        const params = new URLSearchParams();
        if (category) params.append('category', category);
        if (limit) params.append('limit', limit.toString());
        if (offset) params.append('offset', offset.toString());
        const queryString = params.toString() ? `?${params.toString()}` : '';

        return axios({
            method: 'get',
            url: `/users-service/habits/goals/public${queryString}`,
        });
    };

    search = (query: string, limit?: number) => {
        const params = new URLSearchParams();
        params.append('query', query);
        if (limit) params.append('limit', limit.toString());

        return axios({
            method: 'get',
            url: `/users-service/habits/goals/search?${params.toString()}`,
        });
    };

    update = (id: string, data: IUpdateHabitGoalBody) => axios({
        method: 'put',
        url: `/users-service/habits/goals/${id}`,
        data,
    });

    delete = (id: string) => axios({
        method: 'delete',
        url: `/users-service/habits/goals/${id}`,
    });
}

export default new HabitGoalsService();
