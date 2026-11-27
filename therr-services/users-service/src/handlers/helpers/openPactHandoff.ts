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
 *   - a new host takes it (`pacts.creatorUserId`, member role `creator`) and from then on answers
 *     requests and can close it. A partner already in the pact is preferred, longest-standing first;
 *     otherwise the requester who has waited longest. Either must have been active inside the same
 *     window (see `chooseHost`), so a pact never passes from one quiet person to another — with
 *     nobody active to host, nothing is handed off that run;
 *   - everyone else waiting is let in, oldest first, up to the seat limit — the same join path an
 *     approval runs (helpers/pactMembership.ts);
 *   - the quiet creator leaves the pact (member status `left`, as if they had left it). Their own
 *     habit, streaks and check-in history are untouched, and the pact is still open, so they can ask
 *     to rejoin it if they come back.
 *
 * Everyone it touches is told once, all through `pactJoinApproved` copy selectors: each requester
 * let in (`handoff`), the new host (`handoffHost`), the former creator (`handoffFormerCreator` —
 * otherwise their pact simply vanishes from under them, with a request notification still pointing
 * at it), and partners already in it (`handoffPartner`). A requester at their free-tier habit limit is skipped, not approved, exactly as
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
    openPactHandoffNoticeDedupeKey,
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
    /** Requesters let in, the new hosts among them included. */
    requestersApproved: number;
    /** Pacts whose new host is a partner already in them rather than a requester. */
    partnersPromoted: number;
    /** Requesters left pending because they were at their habit limit. */
    requestersAtCapacity: number;
    /** Nobody waiting could be let in (all at capacity, or the pact was full). Left for later. */
    pactsNoEligibleRequester: number;
    /** Somebody could be let in, but nobody who could host has been active recently. Left for later. */
    pactsNoActiveHost: number;
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
    partnersPromoted: 0,
    requestersAtCapacity: 0,
    pactsNoEligibleRequester: 0,
    pactsNoActiveHost: 0,
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
export type PactJoinApprovedReason = 'handoff' | 'handoffHost' | 'handoffFormerCreator' | 'handoffPartner';

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

/** Signed in, checked in, or spoke in this pact's chat inside the same window a creator is judged by. */
const isRecentlyActive = (lastActiveAt: Date | undefined, now: Date) => !!lastActiveAt
    && lastActiveAt.getTime() > now.getTime() - OPEN_PACT_CREATOR_INACTIVE_DAYS * MS_PER_DAY;

const latestOf = (...dates: Array<Date | string | null | undefined>): Date | undefined => dates
    .reduce<Date | undefined>((acc, value) => {
        if (!value) {
            return acc;
        }
        const date = new Date(value);
        return !acc || date.getTime() > acc.getTime() ? date : acc;
    }, undefined);

const memberSince = (member: any) => new Date(member.joinedAt || member.createdAt || 0).getTime();

interface IHandoffHost {
    userId: string;
    userName: string;
    /** The host's own request when the host is a requester; absent for a partner promoted from inside. */
    request?: IPactJoinRequestRow;
    member: any;
}

type EligibleRequester = { request: IPactJoinRequestRow; member: any };

/**
 * Who hosts the pact next:
 *   1. a partner already in it, longest-standing first — someone already committed to this pact;
 *   2. otherwise the longest-waiting requester who could be let in.
 * Either way the host must have shown a sign of life inside the window that judged the creator gone
 * (asking to join counts for a requester), so a pact is never handed from one quiet person to another.
 * Everyone else eligible is let in as a partner whether or not they are recently active.
 */
const chooseHost = (
    partners: any[],
    eligible: EligibleRequester[],
    lastActive: Record<string, Date>,
    now: Date,
): { host: IHandoffHost; joiners: EligibleRequester[] } | { skip: 'pactsNoEligibleRequester' | 'pactsNoActiveHost' } => {
    const partnerHost = partners.find((member) => isRecentlyActive(lastActive[member.userId], now));
    if (partnerHost) {
        return {
            host: { userId: partnerHost.userId, userName: partnerHost.userName || '', member: partnerHost },
            joiners: eligible,
        };
    }
    if (!eligible.length) {
        return { skip: 'pactsNoEligibleRequester' };
    }
    const index = eligible.findIndex(({ request }) => isRecentlyActive(
        latestOf(lastActive[request.requesterUserId], request.createdAt),
        now,
    ));
    if (index < 0) {
        return { skip: 'pactsNoActiveHost' };
    }
    const { request, member } = eligible[index];
    return {
        host: {
            userId: request.requesterUserId, userName: request.requesterUserName || '', request, member,
        },
        joiners: eligible.filter((_, i) => i !== index),
    };
};

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
    const [seats, formerCreatorMember, members] = await Promise.all([
        Store.pacts.countSeats(pact.id),
        Store.pactMembers.getByPactAndUser(pact.id, formerCreatorId),
        Store.pactMembers.getByPactId(pact.id),
    ]);
    const seatsAvailable = MAX_OPEN_PACT_MEMBERS - seats + (isAlreadyMember(formerCreatorMember) ? 1 : 0);

    // Partners already in the pact, longest-standing first. A requester who also holds a seat is
    // handled with the requests, so is not counted here too.
    const requesterIds = new Set(requests.map((request) => request.requesterUserId));
    const partners = (members || [])
        .filter((member: any) => member.status === 'active' && member.userId !== formerCreatorId && !requesterIds.has(member.userId))
        .sort((a: any, b: any) => memberSince(a) - memberSince(b));

    const eligible = await selectEligible(requests, pact.id, seatsAvailable, context, counters);
    const lastActive = await Store.pactJoinRequests.getLastActiveAtByUser(pact.id, [
        ...partners.map((member: any) => member.userId),
        ...eligible.map(({ request }) => request.requesterUserId),
    ]);

    const choice = chooseHost(partners, eligible, lastActive, now);
    if ('skip' in choice) {
        bump(counters, choice.skip);
        return;
    }
    const { host, joiners } = choice;
    const hostUserId = host.userId;

    // Claim a requester-host's request first, so a concurrent cancel resolves once.
    if (host.request) {
        const hostClaim = await Store.pactJoinRequests.resolvePending(host.request.id, 'approved');
        if (!hostClaim) {
            bump(counters, 'pactsSkippedChanged');
            return;
        }
    }
    const revertHostClaim = () => (host.request
        ? Store.pactJoinRequests.revertApproval(host.request.id).catch(() => undefined)
        : Promise.resolve(undefined));

    const handedOff = await Store.pacts.transferCreator(pact.id, formerCreatorId, hostUserId)
        .catch(async (err) => {
            await revertHostClaim();
            throw err;
        });
    if (!handedOff) {
        await revertHostClaim();
        bump(counters, 'pactsSkippedChanged');
        return;
    }

    // The former creator leaves; their role follows the pact's new shape. Their row is kept so the
    // pact stays in their history, exactly as leaving it themselves would.
    // Only a creator still in the pact gets a new `leftAt`; one already out keeps the date they left.
    if (formerCreatorMember) {
        await Store.pactMembers.updateByPactAndUser(pact.id, formerCreatorId, isAlreadyMember(formerCreatorMember)
            ? { role: 'partner', status: 'left', leftAt: now }
            : { role: 'partner' });
    }

    // The host's seat: active from now, like any creator's — a creator's row is active even while
    // the pact waits for its first partner (handlers/pacts.ts § createPact). A promoted partner keeps
    // the date they joined.
    if (host.member) {
        await Store.pactMembers.updateByPactAndUser(pact.id, hostUserId, host.request
            ? { role: 'creator', status: 'active', joinedAt: now }
            : { role: 'creator' });
    } else {
        await Store.pactMembers.create({
            pactId: pact.id,
            userId: hostUserId,
            role: 'creator',
            status: 'active',
        });
    }
    // Both idempotent; a promoted partner already has them unless they archived the habit since.
    await ensureActiveHabitTracking(hostUserId, pact.habitGoalId);
    if (handedOff.status === 'active') {
        // A pending pact creates its creator's streak on the first join (activatePactMembership).
        await Store.streaks.getOrCreate(hostUserId, pact.habitGoalId, pact.id);
    }

    bump(counters, 'pactsHandedOff');
    if (host.request) {
        bump(counters, 'requestersApproved');
        awardJoinXp(hostUserId, host.request.id, context);
    } else {
        bump(counters, 'partnersPromoted');
    }

    const habitName = candidate.habitGoalName || '';
    const queueHandoffPush = (toUserId: string, dedupeKey: string, reason: PactJoinApprovedReason) => queuePush(
        toUserId,
        PushNotifications.Types.pactJoinApproved,
        dedupeKey,
        {
            pactId: pact.id,
            habitName,
            fromUser: { id: hostUserId, userName: host.userName },
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

    await queueHandoffPush(
        hostUserId,
        host.request
            ? openPactHandoffDedupeKey(host.request.id)
            : openPactHandoffNoticeDedupeKey('host', pact.id, formerCreatorId, now),
        'handoffHost',
    );

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
            await queueHandoffPush(request.requesterUserId, openPactHandoffDedupeKey(request.id), 'handoff');
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

    // The people the handoff happened *to* are told too. The former creator learns the pact moved on
    // and that they can ask back in (only one still in it, and never a deleted account); partners
    // already in it learn who hosts it now. Once each per handoff.
    if (isAlreadyMember(formerCreatorMember) && !candidate.creatorIsSoftDeleted) {
        await queueHandoffPush(
            formerCreatorId,
            openPactHandoffNoticeDedupeKey('formerCreator', pact.id, formerCreatorId, now),
            'handoffFormerCreator',
        );
    }
    const remainingPartners = partners.filter((member: any) => member.userId !== hostUserId);
    // eslint-disable-next-line no-restricted-syntax
    for (const member of remainingPartners) {
        // eslint-disable-next-line no-await-in-loop
        await queueHandoffPush(member.userId, openPactHandoffNoticeDedupeKey('partner', pact.id, formerCreatorId, now), 'handoffPartner');
    }

    // A pact's host is connected to every partner in it (activatePactMembership connects each
    // joiner to the creator). The joiners above were connected to the new host as they came in;
    // partners already in a running pact were connected only to the creator who left. Same
    // fire-and-forget contract: a connection failure never undoes the handoff. The partner list is
    // the one read before any write, so it never includes the creator who just left.
    Promise.all(remainingPartners.map((member: any) => ensureCompletedUserConnection(hostUserId, member.userId)))
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
            'pact.hostWasPartner': !host.request,
            'pact.creatorWasSoftDeleted': candidate.creatorIsSoftDeleted,
            'pact.creatorLastActiveAt': candidate.creatorLastActiveAt ? new Date(candidate.creatorLastActiveAt).toISOString() : '',
            joinersApproved: joiners.length,
            partnersNotified: remainingPartners.length,
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
