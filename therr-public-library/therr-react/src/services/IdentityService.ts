/* eslint-disable class-methods-use-this */
import axios from 'axios';

export interface ICreateIdentityReflectionBody {
    reflectionType: string;
    /** Scale prompts (self_concept). */
    responseScore?: number;
    /** Text prompts. */
    responseText?: string;
    /** The check-in that triggered the prompt, when there was one. */
    checkinId?: string;
    /**
     * Only for `partner_affirmation`: the pact partner being affirmed. The server
     * verifies a shared active pact — an affirmation is evidence precisely because
     * it comes from someone else.
     */
    targetUserId?: string;
}

/**
 * Identity progression (habit -> mindset -> identity) for the HABITS app.
 */
class IdentityService {
    /** Every identity the user is building. Stored stages, no re-evaluation. */
    getUserIdentities = () => axios({
        method: 'get',
        url: '/users-service/habits/identity',
    });

    /** Full ladder for one habit, re-evaluated against current evidence. */
    getByHabit = (habitGoalId: string) => axios({
        method: 'get',
        url: `/users-service/habits/identity/habit/${habitGoalId}`,
    });

    setIdentityLabel = (habitGoalId: string, identityLabel: string, pactId?: string) => axios({
        method: 'put',
        url: `/users-service/habits/identity/habit/${habitGoalId}/label`,
        data: { identityLabel, pactId },
    });

    createReflection = (habitGoalId: string, data: ICreateIdentityReflectionBody) => axios({
        method: 'post',
        url: `/users-service/habits/identity/habit/${habitGoalId}/reflections`,
        data,
    });

    getReflections = (habitGoalId: string, limit?: number) => {
        const params = new URLSearchParams();
        if (limit) params.append('limit', limit.toString());
        const queryString = params.toString() ? `?${params.toString()}` : '';

        return axios({
            method: 'get',
            url: `/users-service/habits/identity/habit/${habitGoalId}/reflections${queryString}`,
        });
    };

    /** A pact partner's progress on a shared habit — what to affirm. */
    getPartnerIdentity = (habitGoalId: string, partnerUserId: string) => axios({
        method: 'get',
        url: `/users-service/habits/identity/habit/${habitGoalId}/partner/${partnerUserId}`,
    });
}

export default new IdentityService();
