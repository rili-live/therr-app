/* eslint-disable class-methods-use-this */
import axios from 'axios';

class StreaksService {
    get = (id: string) => axios({
        method: 'get',
        url: `/users-service/habits/streaks/${id}`,
    });

    getUserStreaks = (isActive?: boolean) => {
        const params = new URLSearchParams();
        if (isActive !== undefined) params.append('isActive', isActive.toString());
        const queryString = params.toString() ? `?${params.toString()}` : '';

        return axios({
            method: 'get',
            url: `/users-service/habits/streaks${queryString}`,
        });
    };

    getActiveStreaks = () => axios({
        method: 'get',
        url: '/users-service/habits/streaks/active',
    });

    getByHabit = (habitGoalId: string) => axios({
        method: 'get',
        url: `/users-service/habits/streaks/habit/${habitGoalId}`,
    });

    getPactStreaks = (pactId: string) => axios({
        method: 'get',
        url: `/users-service/habits/streaks/pact/${pactId}`,
    });

    getHistory = (id: string, limit?: number) => {
        const params = new URLSearchParams();
        if (limit) params.append('limit', limit.toString());
        const queryString = params.toString() ? `?${params.toString()}` : '';

        return axios({
            method: 'get',
            url: `/users-service/habits/streaks/${id}/history${queryString}`,
        });
    };

    getMilestones = () => axios({
        method: 'get',
        url: '/users-service/habits/streaks/milestones',
    });

    getTopStreaks = (limit?: number) => {
        const params = new URLSearchParams();
        if (limit) params.append('limit', limit.toString());
        const queryString = params.toString() ? `?${params.toString()}` : '';

        return axios({
            method: 'get',
            url: `/users-service/habits/streaks/top${queryString}`,
        });
    };

    useGraceDay = (id: string) => axios({
        method: 'put',
        url: `/users-service/habits/streaks/${id}/grace`,
    });
}

export default new StreaksService();
