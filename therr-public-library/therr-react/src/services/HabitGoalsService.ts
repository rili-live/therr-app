/* eslint-disable class-methods-use-this */
import axios from 'axios';

export interface ICreateHabitGoalBody {
    name: string;
    description?: string;
    category?: string;
    emoji?: string;
    frequencyType?: string;
    frequencyCount?: number;
    targetDaysOfWeek?: number[];
    isPublic?: boolean;
}

export interface IUpdateHabitGoalBody {
    name?: string;
    description?: string;
    category?: string;
    emoji?: string;
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
