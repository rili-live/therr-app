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

    /**
     * A user's pacts, newest first.
     *
     * Cycles that a re-commit has already continued come back only with
     * `includeSuperseded` — the default list shows one row per habit, and a predecessor is
     * reached through its successor's `renewedFromPactId` instead. Pass it for a history
     * view that wants the whole chain.
     */
    getUserPacts = (status?: string, limit?: number, offset?: number, includeSuperseded?: boolean) => {
        const params = new URLSearchParams();
        if (status) params.append('status', status);
        if (limit) params.append('limit', limit.toString());
        if (offset) params.append('offset', offset.toString());
        if (includeSuperseded) params.append('includeSuperseded', 'true');
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
     * ended yet or the user already has a live pact for *another* pact on that habit.
     *
     * Idempotent: a pact that has already been continued answers **200** with the
     * cycle that continues it rather than starting a second one. So a double-tap,
     * a retry, or a stale CTA left over from another member's renewal all end with
     * the caller holding the one real successor — check the status code, not the
     * body, to tell a fresh renewal from a repeat.
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
