/* eslint-disable class-methods-use-this */
import axios from 'axios';

export interface ICreateUserHabitGoalBody {
    name: string;
    description?: string;
    category?: string;
    emoji?: string;
    goalType?: string;
    frequencyType?: string;
    frequencyCount?: number;
    targetDaysOfWeek?: number[];
}

/**
 * Either point at an existing habit goal, or supply one to create and track in
 * the same request. The second form keeps the "track this on my own" branch of
 * the pact wizard to a single call, so a failure cannot strand a habit goal
 * with nothing tracking it.
 */
export interface ICreateUserHabitBody {
    habitGoalId?: string;
    goal?: ICreateUserHabitGoalBody;
}

class UserHabitsService {
    getUserHabits = (status?: 'active' | 'archived') => {
        const params = new URLSearchParams();
        if (status) params.append('status', status);
        const queryString = params.toString() ? `?${params.toString()}` : '';

        return axios({
            method: 'get',
            url: `/users-service/habits/user-habits${queryString}`,
        });
    };

    getEligibility = () => axios({
        method: 'get',
        url: '/users-service/habits/user-habits/eligibility',
    });

    create = (data: ICreateUserHabitBody) => axios({
        method: 'post',
        url: '/users-service/habits/user-habits',
        data,
    });

    archive = (id: string) => axios({
        method: 'put',
        url: `/users-service/habits/user-habits/${id}/archive`,
    });

    restore = (id: string) => axios({
        method: 'put',
        url: `/users-service/habits/user-habits/${id}/restore`,
    });

    /**
     * Keep a habit whose invite went unanswered as a solo one: abandons the
     * outstanding pact and re-gates on the solo-unlock threshold. A 403
     * `solo-locked` (with `invitedCount`/`requiredCount`) means the caller has
     * not invited enough distinct people yet — the client renders progress rather
     * than treating it as a hard error.
     */
    continueSolo = (id: string) => axios({
        method: 'put',
        url: `/users-service/habits/user-habits/${id}/continue-solo`,
    });
}

export default new UserHabitsService();
