/* eslint-disable class-methods-use-this */
import axios from 'axios';

export interface ICreateCheckinBody {
    pactId?: string;
    habitGoalId: string;
    scheduledDate?: string;
    status?: 'pending' | 'completed' | 'partial' | 'skipped' | 'missed';
    notes?: string;
    selfRating?: number;
    difficultyRating?: number;
}

export interface IUpdateCheckinBody {
    status?: 'pending' | 'completed' | 'partial' | 'skipped' | 'missed';
    notes?: string;
    selfRating?: number;
    difficultyRating?: number;
}

class HabitCheckinsService {
    create = (data: ICreateCheckinBody) => axios({
        method: 'post',
        url: '/users-service/habits/checkins',
        data,
    });

    get = (id: string) => axios({
        method: 'get',
        url: `/users-service/habits/checkins/${id}`,
    });

    getTodayCheckins = (habitGoalId?: string) => {
        const params = new URLSearchParams();
        if (habitGoalId) params.append('habitGoalId', habitGoalId);
        const queryString = params.toString() ? `?${params.toString()}` : '';

        return axios({
            method: 'get',
            url: `/users-service/habits/checkins/today${queryString}`,
        });
    };

    getByDateRange = (startDate: string, endDate: string, habitGoalId?: string) => {
        const params = new URLSearchParams();
        params.append('startDate', startDate);
        params.append('endDate', endDate);
        if (habitGoalId) params.append('habitGoalId', habitGoalId);

        return axios({
            method: 'get',
            url: `/users-service/habits/checkins/range?${params.toString()}`,
        });
    };

    getPactCheckins = (pactId: string, limit?: number, offset?: number) => {
        const params = new URLSearchParams();
        if (limit) params.append('limit', limit.toString());
        if (offset) params.append('offset', offset.toString());
        const queryString = params.toString() ? `?${params.toString()}` : '';

        return axios({
            method: 'get',
            url: `/users-service/habits/checkins/pact/${pactId}${queryString}`,
        });
    };

    update = (id: string, data: IUpdateCheckinBody) => axios({
        method: 'put',
        url: `/users-service/habits/checkins/${id}`,
        data,
    });

    skip = (id: string, notes?: string) => axios({
        method: 'put',
        url: `/users-service/habits/checkins/${id}/skip`,
        data: { notes },
    });

    delete = (id: string) => axios({
        method: 'delete',
        url: `/users-service/habits/checkins/${id}`,
    });
}

export default new HabitCheckinsService();
