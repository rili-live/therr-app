/* eslint-disable class-methods-use-this */
import axios from 'axios';

export interface ICreatePactBody {
    partnerUserId?: string;
    habitGoalId: string;
    pactType?: 'accountability' | 'challenge' | 'support';
    durationDays?: number;
    consequenceType?: 'none' | 'donation' | 'dare' | 'custom';
    consequenceDetails?: {
        amount?: number;
        charity?: string;
        description?: string;
    };
}

export interface IBulkInvitePactBody {
    habitGoalId: string;
    partnerUserIds: string[];
    pactType?: 'accountability' | 'challenge' | 'support';
    durationDays?: number;
    consequenceType?: 'none' | 'donation' | 'dare' | 'custom';
    consequenceDetails?: {
        amount?: number;
        charity?: string;
        description?: string;
    };
}

class PactsService {
    create = (data: ICreatePactBody) => axios({
        method: 'post',
        url: '/users-service/habits/pacts',
        data,
    });

    bulkInvite = (data: IBulkInvitePactBody) => axios({
        method: 'post',
        url: '/users-service/habits/pacts/bulk-invite',
        data,
    });

    get = (id: string) => axios({
        method: 'get',
        url: `/users-service/habits/pacts/${id}`,
    });

    getUserPacts = (status?: string, limit?: number, offset?: number) => {
        const params = new URLSearchParams();
        if (status) params.append('status', status);
        if (limit) params.append('limit', limit.toString());
        if (offset) params.append('offset', offset.toString());
        const queryString = params.toString() ? `?${params.toString()}` : '';

        return axios({
            method: 'get',
            url: `/users-service/habits/pacts${queryString}`,
        });
    };

    getActivePacts = () => axios({
        method: 'get',
        url: '/users-service/habits/pacts/active',
    });

    getPendingInvites = () => axios({
        method: 'get',
        url: '/users-service/habits/pacts/invites',
    });

    nudge = (id: string) => axios({
        method: 'put',
        url: `/users-service/habits/pacts/${id}/nudge`,
    });

    accept = (id: string) => axios({
        method: 'put',
        url: `/users-service/habits/pacts/${id}/accept`,
    });

    decline = (id: string) => axios({
        method: 'put',
        url: `/users-service/habits/pacts/${id}/decline`,
    });

    abandon = (id: string) => axios({
        method: 'put',
        url: `/users-service/habits/pacts/${id}/abandon`,
    });

    /**
     * Starts a new cycle on the same habit goal, re-inviting the members of the
     * one that ended. Answers 201 with the new pact; 409 when the pact has not
     * ended yet or the user already has a live pact for that habit.
     *
     * `durationDays` is optional — omitted, the new cycle inherits the length of
     * the one being renewed.
     */
    renew = (id: string, durationDays?: number) => axios({
        method: 'put',
        url: `/users-service/habits/pacts/${id}/renew`,
        data: durationDays ? { durationDays } : {},
    });

    delete = (id: string) => axios({
        method: 'delete',
        url: `/users-service/habits/pacts/${id}`,
    });
}

export default new PactsService();
