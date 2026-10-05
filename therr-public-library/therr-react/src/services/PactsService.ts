/* eslint-disable class-methods-use-this */
import axios from 'axios';
import { PledgeCharityKey } from 'therr-js-utilities/constants';

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
    /** Let people outside the pact ask to join it. Opt-in; omitted means closed. */
    isOpen?: boolean;
}

/** A member's own charity pledge on a pact (Phase A: no money moves). Validated server-side. */
export interface ISetPactPledgeBody {
    amount: number;
    charityKey: PledgeCharityKey;
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
    /** Let people outside the pact ask to join it. Opt-in; omitted means closed. */
    isOpen?: boolean;
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

    /**
     * Invite more people into an existing pact. Creator only, and only while the pact is still
     * live (pending or active). New invitees join as `pending` and become `active` on accept.
     * Answers 200 with the hydrated pact (members + derived stats).
     */
    addMembers = (id: string, partnerUserIds: string[]) => axios({
        method: 'post',
        url: `/users-service/habits/pacts/${id}/members`,
        data: { partnerUserIds },
    });

    /**
     * Remove a member from a pact. Creator only. Refused (409) when it would drop the pact
     * below the two-member minimum — the last remaining member takes `continueSolo` instead.
     */
    removeMember = (id: string, userId: string) => axios({
        method: 'delete',
        url: `/users-service/habits/pacts/${id}/members/${userId}`,
    });

    /**
     * The last remaining active member opts to keep the pact going alone. Answers 200 with the
     * pact now flagged solo; 409 if more than one member is still active or it is already solo.
     */
    continueSolo = (id: string) => axios({
        method: 'put',
        url: `/users-service/habits/pacts/${id}/continue-solo`,
    });

    /**
     * Set or edit the caller's own pledge on a pact. Only an active member of a pending or active
     * pact may pledge (403 otherwise). Answers 200 with `{ pactId, pledge }`; editing keeps the
     * original `pledgedAt`, which dates the first week the pledge governs.
     */
    setPledge = (id: string, data: ISetPactPledgeBody) => axios({
        method: 'put',
        url: `/users-service/habits/pacts/${id}/pledge`,
        data,
    });

    /** Remove the caller's own pledge. Answers 200 with `{ pactId, pledge: null }`. */
    removePledge = (id: string) => axios({
        method: 'delete',
        url: `/users-service/habits/pacts/${id}/pledge`,
    });

    // ---- Open pacts ---------------------------------------------------------------------
    // Opt-in on both sides: a creator opens a pact, and someone outside it asks to join. The
    // creator answers each request. Approving makes the requester an ordinary active member.

    /**
     * Open pacts the caller could ask to join, answered as `{ pacts: IOpenPact[] }`. With
     * `habitGoalId`, only those on the same habit as that goal — matched on the template it came
     * from, or its name — which is what an unanswered invite offers instead.
     */
    getOpenPacts = (habitGoalId?: string) => axios({
        method: 'get',
        url: `/users-service/habits/pacts/open${habitGoalId ? `?habitGoalId=${encodeURIComponent(habitGoalId)}` : ''}`,
    });

    /** Creator only. Opening needs a pending or running pact; closing is always allowed. */
    setOpen = (id: string, isOpen: boolean) => axios({
        method: 'put',
        url: `/users-service/habits/pacts/${id}/open`,
        data: { isOpen },
    });

    /**
     * Ask to join an open pact. 201 with the new request; 200 with the one already waiting (the
     * creator is not notified twice); 402 at the free-tier habit cap, like any habit start.
     */
    requestToJoin = (id: string) => axios({
        method: 'post',
        url: `/users-service/habits/pacts/${id}/join-requests`,
    });

    /** Withdraw the caller's own pending request. */
    cancelJoinRequest = (id: string) => axios({
        method: 'delete',
        url: `/users-service/habits/pacts/${id}/join-requests/mine`,
    });

    /** Creator only: pending requests on a pact, as `{ requests: IPactJoinRequest[] }`. */
    getJoinRequests = (id: string) => axios({
        method: 'get',
        url: `/users-service/habits/pacts/${id}/join-requests`,
    });

    /**
     * Creator only. Answers 200 with the pact; 409 when the requester has no free habit slot (the
     * request stays pending); 400 when the pact has filled up or ended.
     */
    approveJoinRequest = (id: string, requestId: string) => axios({
        method: 'put',
        url: `/users-service/habits/pacts/${id}/join-requests/${requestId}/approve`,
    });

    /** Creator only. Silent to the requester. */
    declineJoinRequest = (id: string, requestId: string) => axios({
        method: 'put',
        url: `/users-service/habits/pacts/${id}/join-requests/${requestId}/decline`,
    });

    delete = (id: string) => axios({
        method: 'delete',
        url: `/users-service/habits/pacts/${id}`,
    });
}

export default new PactsService();
