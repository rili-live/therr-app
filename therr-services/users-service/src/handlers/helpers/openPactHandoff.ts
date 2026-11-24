/**
 * The open-pact handoff: one pass inside the daily habits digest.
 *
 * Only an open pact's creator can answer a request to join it (handlers/pactJoinRequests.ts). When
 * the creator has stopped using the app, that request is answered by nobody: the push and the
 * 24-hour email (helpers/joinRequestEmailDigest.ts) land on a dead channel, the requester waits on
 * a pact that will never move, and the request goes on holding one of their three pending slots.
 * Requests answered by nobody are the opposite of what open pacts exist for.
 *
 * So when a request has waited OPEN_PACT_HANDOFF_MIN_REQUEST_AGE_DAYS and the creator has shown no
 * sign of life for OPEN_PACT_CREATOR_INACTIVE_DAYS (or deleted their account), the pact moves on
 * without them:
 *   - the requester who has waited longest becomes its host (`pacts.creatorUserId`, member role
 *     `creator`): they now answer any later requests and can close it;
 *   - everyone else waiting is let in, oldest first, up to the seat limit — the same join path an
 *     approval runs (helpers/pactMembership.ts);
 *   - the quiet creator leaves the pact (member status `left`, as if they had left it). Their own
 *     habit, streaks and check-in history are untouched, and the pact is still open, so they can ask
 *     to rejoin it if they come back.
 *
 * Each person let in gets a `pactJoinApproved` push (the new host its `handoffHost` copy), queued
 * once per request. A requester at their free-tier habit limit is skipped, not approved, exactly as
 * an approval would refuse them; their request stays pending for a later run or for the new host.
 */

import { BrandVariations, PushNotifications } from 'therr-js-utilities/constants';
import logSpan from 'therr-js-utilities/log-or-update-span';
import Store from '../../store';
import { IPactAwaitingHandoffRow, IPactJoinRequestRow } from '../../store/PactJoinRequestsStore';
import {
    isPactJoinable,
    JOIN_REQUEST_EXPIRY_DAYS,
    JOINABLE_PACT_STATUSES,
    MAX_OPEN_PACT_MEMBERS,
    OPEN_PACT_CREATOR_INACTIVE_DAYS,
    OPEN_PACT_HANDOFF_MIN_REQUEST_AGE_DAYS,
    openPactHandoffDedupeKey,
} from '../../utilities/openPacts';
import { LeaderboardXpValues } from '../../utilities/leaderboardHelpers';
import { checkHabitCapacity } from './habitCapacity';
import { ensureCompletedUserConnection } from './inviteAcceptance';
import { activatePactMembership, ensureActiveHabitTracking } from './pactMembership';
import { awardLeaderboardPoints } from './leaderboards';
import { QueueRecapFn } from './weeklyRecapDigest';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Upper bound per run. Reported via `pactsCapped` rather than silently truncated. */
export const OPEN_PACT_HANDOFF_MAX_PACTS = 200;

/**
 * Kill switch. Defaults **on**: it acts only on pacts whose creator has been gone a week while
 * someone waited, and each person is told once. It stays a flag because it changes who runs a
 * pact, and this is the lever that stops it without a deploy. Request expiry is not behind it:
 * that only ever frees the requester's slot.
 */
export const isOpenPactHandoffEnabled = (): boolean => process.env.HABIT_OPEN_PACT_HANDOFF_ENABLED !== 'false';

export interface IOpenPactHandoffCounters {
    /** Open pacts with a request waiting long enough on a creator gone quiet. */
    pactsEvaluated: number;
    /** Pacts handed to a new host. */
    pactsHandedOff: number;
    /** Requesters let in, the new hosts included. */
    requestersApproved: number;
    /** Requesters left pending because they were at their habit limit. */
    requestersAtCapacity: number;
    /** Nobody waiting could be let in (all at capacity, or the pact was full). Left for later. */
    pactsNoEligibleRequester: number;
    /** Changed between the read and the handoff: answered, closed, ended, or moved by another run. */
    pactsSkippedChanged: number;
    /** Pending requests expired: too old, or on a pact that stopped running. */
    requestsExpired: number;
    handoffErrors: number;
    pushErrors: number;
    pactsCapped: boolean;
}

export const EMPTY_OPEN_PACT_HANDOFF_COUNTERS: IOpenPactHandoffCounters = {
    pactsEvaluated: 0,
    pactsHandedOff: 0,
    requestersApproved: 0,
    requestersAtCapacity: 0,
    pactsNoEligibleRequester: 0,
    pactsSkippedChanged: 0,
    requestsExpired: 0,
    handoffErrors: 0,
    pushErrors: 0,
    pactsCapped: false,
};

export interface IOpenPactHandoffContext {
    /** Pinned by the digest. Selects the capacity rules and the leaderboard partition. */
    brandVariation: BrandVariations;
}

/** The one copy selector the push service reads for `pactJoinApproved` (see firebaseAdmin.ts). */
export type PactJoinApprovedReason = 'handoff' | 'handoffHost';

/**
 * The helpers below share the pass's one counters object, so they add to it rather than return
 * partial tallies to merge — the only parameter they mutate, hence the one exemption here.
 */
const bump = (counters: IOpenPactHandoffCounters, key: keyof Omit<IOpenPactHandoffCounters, 'pactsCapped'>, by = 1) => {
    counters[key] += by; // eslint-disable-line no-param-reassign
};

const isAlreadyMember = (member: any) => !!member && (member.status === 'active' || member.status === 'pending');

/**
 * Who of the waiting requesters can be let in, oldest first, within the seats there are. A
 * requester already in the pact is not a seat taken twice; one at their habit limit is skipped.
 */
const selectEligible = async (
    requests: IPactJoinRequestRow[],
    pactId: string,
    seatsAvailable: number,
    context: IOpenPactHandoffContext,
    counters: IOpenPactHandoffCounters,
) => {
    const eligible: { request: IPactJoinRequestRow; member: any }[] = [];
    let seatsLeft = seatsAvailable;
    // eslint-disable-next-line no-restricted-syntax
    for (const request of requests) {
        // eslint-disable-next-line no-await-in-loop
        const member = await Store.pactMembers.getByPactAndUser(pactId, request.requesterUserId);
        const alreadyIn = isAlreadyMember(member);
        if (!alreadyIn && seatsLeft <= 0) {
            // Not `break`: a later requester who is already in the pact needs no seat.
            // eslint-disable-next-line no-continue
            continue;
        }
        if (!member || member.status !== 'active') {
            // eslint-disable-next-line no-await-in-loop
            const denial = await checkHabitCapacity({ userId: request.requesterUserId, brandVariation: context.brandVariation });
            if (denial) {
                bump(counters, 'requestersAtCapacity');
                // eslint-disable-next-line no-continue
                continue;
            }
        }
        eligible.push({ request, member });
        if (!alreadyIn) {
            seatsLeft -= 1;
        }
    }
    return eligible;
};

const awardJoinXp = (userId: string, requestId: string, context: IOpenPactHandoffContext) => awardLeaderboardPoints(
    { 'x-userid': userId, 'x-brand-variation': context.brandVariation } as any,
    LeaderboardXpValues.openPactJoined,
    `open-pact-joined:${requestId}`,
);

const handOffPact = async (
    candidate: IPactAwaitingHandoffRow,
    queuePush: QueueRecapFn,
    context: IOpenPactHandoffContext,
    counters: IOpenPactHandoffCounters,
    now: Date,
) => {
    const formerCreatorId = candidate.creatorUserId;
    const pact = await Store.pacts.getById(candidate.pactId);
    // Re-read: the creator may have come back, closed it, or another run may have moved it.
    if (!pact || pact.creatorUserId !== formerCreatorId || !isPactJoinable(pact, now)) {
        bump(counters, 'pactsSkippedChanged');
        return;
    }

    // A requester who has since deleted their account is never made host or let in: the pact would
    // just be handed to another dead channel.
    const requests = await Store.pactJoinRequests.getPendingByPact(pact.id, { excludeSoftDeletedRequesters: true });
    if (!requests.length) {
        bump(counters, 'pactsSkippedChanged');
        return;
    }

    // The former creator's seat is freed by their leaving.
    const [seats, formerCreatorMember] = await Promise.all([
        Store.pacts.countSeats(pact.id),
        Store.pactMembers.getByPactAndUser(pact.id, formerCreatorId),
    ]);
    const seatsAvailable = MAX_OPEN_PACT_MEMBERS - seats + (isAlreadyMember(formerCreatorMember) ? 1 : 0);

    const eligible = await selectEligible(requests, pact.id, seatsAvailable, context, counters);
    if (!eligible.length) {
        bump(counters, 'pactsNoEligibleRequester');
        return;
    }

    const [host, ...joiners] = eligible;

    // Claim the host's request first, so a concurrent cancel resolves once.
    const hostClaim = await Store.pactJoinRequests.resolvePending(host.request.id, 'approved');
    if (!hostClaim) {
        bump(counters, 'pactsSkippedChanged');
        return;
    }

    const handedOff = await Store.pacts.transferCreator(pact.id, formerCreatorId, host.request.requesterUserId)
        .catch(async (err) => {
            await Store.pactJoinRequests.revertApproval(host.request.id).catch(() => undefined);
            throw err;
        });
    if (!handedOff) {
        await Store.pactJoinRequests.revertApproval(host.request.id).catch(() => undefined);
        bump(counters, 'pactsSkippedChanged');
        return;
    }

    const hostUserId = host.request.requesterUserId;
    // The former creator leaves; their role follows the pact's new shape. Their row is kept so the
    // pact stays in their history, exactly as leaving it themselves would.
    // Only a creator still in the pact gets a new `leftAt`; one already out keeps the date they left.
    if (formerCreatorMember) {
        await Store.pactMembers.updateByPactAndUser(pact.id, formerCreatorId, isAlreadyMember(formerCreatorMember)
            ? { role: 'partner', status: 'left', leftAt: now }
            : { role: 'partner' });
    }

    // The host's seat: active from now, like any creator's — a creator's row is active even while
    // the pact waits for its first partner (handlers/pacts.ts § createPact).
    if (host.member) {
        await Store.pactMembers.updateByPactAndUser(pact.id, hostUserId, { role: 'creator', status: 'active', joinedAt: now });
    } else {
        await Store.pactMembers.create({
            pactId: pact.id,
            userId: hostUserId,
            role: 'creator',
            status: 'active',
        });
    }
    await ensureActiveHabitTracking(hostUserId, pact.habitGoalId);
    if (handedOff.status === 'active') {
        // A pending pact creates its creator's streak on the first join (activatePactMembership).
        await Store.streaks.getOrCreate(hostUserId, pact.habitGoalId, pact.id);
    }

    bump(counters, 'pactsHandedOff');
    bump(counters, 'requestersApproved');
    awardJoinXp(hostUserId, host.request.id, context);

    const habitName = candidate.habitGoalName || '';
    const hostName = host.request.requesterUserName || '';
    const queueApproved = (toUserId: string, requestId: string, reason: PactJoinApprovedReason) => queuePush(
        toUserId,
        PushNotifications.Types.pactJoinApproved,
        openPactHandoffDedupeKey(requestId),
        {
            pactId: pact.id,
            habitName,
            fromUser: { id: hostUserId, userName: hostName },
            pactJoinApprovedReason: reason,
        },
        undefined,
    ).then((outcome) => {
        if (outcome === 'failed') {
            bump(counters, 'pushErrors');
        }
    }).catch(() => {
        bump(counters, 'pushErrors');
    });

    await queueApproved(hostUserId, host.request.id, 'handoffHost');

    // Everyone else waiting joins the pact under its new host. The first of them activates a pact
    // that was still waiting for its first partner, and the host with it.
    let currentPact = handedOff;
    // eslint-disable-next-line no-restricted-syntax
    for (const { request, member } of joiners) {
        try {
            // eslint-disable-next-line no-await-in-loop
            const claimed = await Store.pactJoinRequests.resolvePending(request.id, 'approved');
            if (!claimed) {
                // eslint-disable-next-line no-continue
                continue;
            }
            try {
                if (!member) {
                    // eslint-disable-next-line no-await-in-loop
                    await Store.pactMembers.create({
                        pactId: pact.id,
                        userId: request.requesterUserId,
                        role: 'partner',
                        status: 'pending',
                    });
                }
                // eslint-disable-next-line no-await-in-loop
                currentPact = (await activatePactMembership(currentPact, request.requesterUserId)) || currentPact;
            } catch (err) {
                // eslint-disable-next-line no-await-in-loop
                await Store.pactJoinRequests.revertApproval(request.id).catch(() => undefined);
                throw err;
            }
            bump(counters, 'requestersApproved');
            awardJoinXp(request.requesterUserId, request.id, context);
            // eslint-disable-next-line no-await-in-loop
            await queueApproved(request.requesterUserId, request.id, 'handoff');
        } catch (err: any) {
            bump(counters, 'handoffErrors');
            logSpan({
                level: 'error',
                messageOrigin: 'API_SERVER',
                messages: [err?.message, 'Habits digest: failed to let a requester into a handed-off pact'],
                traceArgs: { 'pact.id': pact.id, 'user.id': request.requesterUserId },
            });
        }
    }

    // A pact's host is connected to every partner in it (activatePactMembership connects each
    // joiner to the creator). The joiners above were connected to the new host as they came in;
    // partners already in a running pact were connected only to the creator who left. Same
    // fire-and-forget contract: a connection failure never undoes the handoff.
    // The former creator is excluded by id, not only by status: this read may hit a replica that
    // has not yet seen them marked `left` above.
    const skipIds = new Set([hostUserId, formerCreatorId, ...joiners.map(({ request }) => request.requesterUserId)]);
    Store.pactMembers.getByPactId(pact.id)
        .then((members: any[]) => Promise.all((members || [])
            .filter((m) => m.status === 'active' && !skipIds.has(m.userId))
            .map((m) => ensureCompletedUserConnection(hostUserId, m.userId))))
        .catch((err: any) => {
            logSpan({
                level: 'error',
                messageOrigin: 'API_SERVER',
                messages: [err?.message, 'Habits digest: failed to connect a handed-off pact\'s new host to its partners'],
                traceArgs: { 'pact.id': pact.id, 'user.id': hostUserId },
            });
        });

    logSpan({
        level: 'info',
        messageOrigin: 'API_SERVER',
        messages: ['Habits digest: open pact handed to a new host'],
        traceArgs: {
            'pact.id': pact.id,
            'pact.formerCreatorUserId': formerCreatorId,
            'pact.hostUserId': hostUserId,
            'pact.creatorWasSoftDeleted': candidate.creatorIsSoftDeleted,
            'pact.creatorLastActiveAt': candidate.creatorLastActiveAt ? new Date(candidate.creatorLastActiveAt).toISOString() : '',
            joinersApproved: joiners.length,
        },
    });
};

export const runOpenPactHandoffPass = async (
    queuePush: QueueRecapFn,
    context: IOpenPactHandoffContext,
    now: Date = new Date(),
): Promise<IOpenPactHandoffCounters> => {
    const counters: IOpenPactHandoffCounters = { ...EMPTY_OPEN_PACT_HANDOFF_COUNTERS };

    if (isOpenPactHandoffEnabled()) {
        const candidates = await Store.pactJoinRequests.getPactsAwaitingHandoff(
            new Date(now.getTime() - OPEN_PACT_HANDOFF_MIN_REQUEST_AGE_DAYS * MS_PER_DAY),
            new Date(now.getTime() - OPEN_PACT_CREATOR_INACTIVE_DAYS * MS_PER_DAY),
            JOINABLE_PACT_STATUSES,
            OPEN_PACT_HANDOFF_MAX_PACTS,
            now,
        );
        counters.pactsEvaluated = candidates.length;
        counters.pactsCapped = candidates.length >= OPEN_PACT_HANDOFF_MAX_PACTS;

        // Sequential: each pact is a short run of claims and writes, the population is small, and a
        // user waiting on two quiet pacts must not be let into both by racing iterations.
        // eslint-disable-next-line no-restricted-syntax
        for (const candidate of candidates) {
            try {
                // eslint-disable-next-line no-await-in-loop
                await handOffPact(candidate, queuePush, context, counters, now);
            } catch (err: any) {
                counters.handoffErrors += 1;
                logSpan({
                    level: 'error',
                    messageOrigin: 'API_SERVER',
                    messages: [err?.message, 'Habits digest: failed to hand off an open pact'],
                    traceArgs: { 'pact.id': candidate.pactId, 'user.id': candidate.creatorUserId },
                });
            }
        }
    }

    // After the handoff, so a request it could still have honoured is never expired first.
    const expired = await Store.pactJoinRequests.expireStale(
        new Date(now.getTime() - JOIN_REQUEST_EXPIRY_DAYS * MS_PER_DAY),
        JOINABLE_PACT_STATUSES,
        now,
    );
    counters.requestsExpired = expired.length;

    return counters;
};
