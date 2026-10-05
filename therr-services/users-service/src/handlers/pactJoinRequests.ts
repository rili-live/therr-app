import { RequestHandler } from 'express';
import { validate as isUuid } from 'uuid';
import {
    ErrorCodes,
    Notifications,
    PushNotifications,
} from 'therr-js-utilities/constants';
import { parseHeaders } from 'therr-js-utilities/http';
import logSpan from 'therr-js-utilities/log-or-update-span';
import Store from '../store';
import handleHttpError from '../utilities/handleHttpError';
import translate from '../utilities/translator';
import sendEmailAndOrPushNotification from '../utilities/sendEmailAndOrPushNotification';
import {
    getHabitMatchKey,
    isPactJoinable,
    JOINABLE_PACT_STATUSES,
    MAX_OPEN_PACT_MEMBERS,
    MAX_PENDING_JOIN_REQUESTS_PER_USER,
} from '../utilities/openPacts';
import { checkHabitCapacity } from './helpers/habitCapacity';
import { activatePactMembership } from './helpers/pactMembership';

/**
 * Open pacts: a creator may let people outside their contacts ask to join a pact, and answers each
 * request. Entirely opt-in — a pact is closed unless its creator opens it, and nothing here changes
 * how invitations work. See utilities/openPacts.ts for the rules and migrations 20261005000001-3
 * for the schema.
 */

const notFound = (res: any, locale: string) => handleHttpError({
    res,
    message: translate(locale, 'errorMessages.pacts.notFound'),
    statusCode: 404,
    errorCode: ErrorCodes.NOT_FOUND,
});

const isPactRunning = (pact: any, now = new Date()) => JOINABLE_PACT_STATUSES.includes(pact.status)
    && (!pact.endDate || new Date(pact.endDate).getTime() > now.getTime());

// READ — open pacts the caller could ask to join. With `habitGoalId`, only those on the same habit
// as that goal (the "your invite went unanswered" path); without it, any open pact.
const getOpenPacts: RequestHandler = async (req: any, res: any) => {
    const { locale, userId } = parseHeaders(req.headers);
    const { habitGoalId } = req.query || {};

    try {
        let matchKey;
        if (habitGoalId) {
            // A value that is not a uuid cannot name a goal. Checked here because Postgres would
            // otherwise reject the comparison with a cast error, which surfaces as a 500.
            const goal = isUuid(String(habitGoalId))
                ? await Store.habitGoals.getById(String(habitGoalId))
                : undefined;
            if (!goal) {
                return handleHttpError({
                    res,
                    message: translate(locale, 'errorMessages.habits.habitGoalNotFound'),
                    statusCode: 404,
                    errorCode: ErrorCodes.NOT_FOUND,
                });
            }
            matchKey = getHabitMatchKey(goal);
        }

        const pacts = await Store.pacts.getOpenPacts(userId, matchKey);
        return res.status(200).send({ pacts });
    } catch (err: any) {
        return handleHttpError({ err, res, message: 'SQL:PACTS_ROUTES:ERROR' });
    }
};

// UPDATE — the creator opens or closes their pact to join requests. Closing stops new requests;
// requests already waiting can still be answered.
const setPactOpen: RequestHandler = async (req: any, res: any) => {
    const { locale, userId } = parseHeaders(req.headers);
    const { id } = req.params;
    const { isOpen } = req.body || {};

    if (typeof isOpen !== 'boolean') {
        return handleHttpError({
            res,
            message: translate(locale, 'errorMessages.pacts.invalidOpenFlag'),
            statusCode: 400,
            errorCode: ErrorCodes.BAD_REQUEST,
        });
    }

    try {
        const pact = await Store.pacts.getById(id);
        if (!pact) {
            return notFound(res, locale);
        }
        if (pact.creatorUserId !== userId) {
            return handleHttpError({
                res,
                message: translate(locale, 'errorMessages.pacts.openCreatorOnly'),
                statusCode: 403,
                errorCode: ErrorCodes.NOT_PERMITTED,
            });
        }
        if (isOpen && !isPactRunning(pact)) {
            return handleHttpError({
                res,
                message: translate(locale, 'errorMessages.pacts.openNotAllowed'),
                statusCode: 400,
                errorCode: ErrorCodes.BAD_REQUEST,
            });
        }

        const updated = await Store.pacts.setOpen(id, isOpen);
        return res.status(200).send(updated);
    } catch (err: any) {
        return handleHttpError({ err, res, message: 'SQL:PACTS_ROUTES:ERROR' });
    }
};

// CREATE — ask to join an open pact. Idempotent: asking twice returns the request already waiting
// and does not notify the creator again.
const requestToJoinPact: RequestHandler = async (req: any, res: any) => {
    const {
        locale,
        userId,
        userName,
        authorization,
        whiteLabelOrigin,
        brandVariation,
    } = parseHeaders(req.headers);
    const { id } = req.params;

    try {
        const pact = await Store.pacts.getById(id);
        if (!pact) {
            return notFound(res, locale);
        }
        if (!isPactJoinable(pact)) {
            return handleHttpError({
                res,
                message: translate(locale, 'errorMessages.pacts.notOpen'),
                statusCode: 400,
                errorCode: ErrorCodes.BAD_REQUEST,
            });
        }

        const member = pact.creatorUserId === userId
            ? { status: 'active' }
            : await Store.pactMembers.getByPactAndUser(id, userId);
        if (member && (member.status === 'active' || member.status === 'pending')) {
            return handleHttpError({
                res,
                message: translate(locale, 'errorMessages.pacts.alreadyInPact'),
                statusCode: 400,
                errorCode: ErrorCodes.BAD_REQUEST,
            });
        }

        const existing = await Store.pactJoinRequests.getPendingByPactAndRequester(id, userId);
        if (existing) {
            return res.status(200).send(existing);
        }

        const seats = await Store.pacts.countSeats(id);
        if (seats >= MAX_OPEN_PACT_MEMBERS) {
            return handleHttpError({
                res,
                message: translate(locale, 'errorMessages.pacts.notAcceptingMembers'),
                statusCode: 400,
                errorCode: ErrorCodes.BAD_REQUEST,
            });
        }

        const pendingCount = await Store.pactJoinRequests.countPendingByRequester(userId);
        if (pendingCount >= MAX_PENDING_JOIN_REQUESTS_PER_USER) {
            return handleHttpError({
                res,
                message: translate(locale, 'errorMessages.pacts.tooManyJoinRequests', { limit: MAX_PENDING_JOIN_REQUESTS_PER_USER }),
                statusCode: 400,
                errorCode: ErrorCodes.BAD_REQUEST,
            });
        }

        // Joining starts tracking a habit, so the requester needs a free slot — checked now, at the
        // ask, so the paywall meets them here instead of the creator meeting a dead approve button.
        // It is checked again at approval, because the slot can be spent in between.
        const capacityDenial = await checkHabitCapacity({ userId, brandVariation, locale });
        if (capacityDenial) {
            return res.status(402).send(capacityDenial);
        }

        const created = await Store.pactJoinRequests.createPending(id, userId);
        if (!created) {
            // A concurrent tap inserted first; theirs is the request.
            const raced = await Store.pactJoinRequests.getPendingByPactAndRequester(id, userId);
            return res.status(200).send(raced);
        }

        const habitGoal = await Store.habitGoals.getById(pact.habitGoalId).catch(() => undefined);
        const habitName = habitGoal?.name || '';

        // In-app row first: it is what routes the creator to the pact, push or no push. Deferred
        // into the promise because `createNotification` can throw synchronously on a bad brand.
        Promise.resolve().then(() => Store.notifications.createNotification(brandVariation, {
            userId: pact.creatorUserId,
            type: Notifications.Types.PACT_JOIN_REQUEST,
            associationId: id,
            isUnread: true,
            messageLocaleKey: Notifications.MessageKeys.PACT_JOIN_REQUEST,
            messageParams: {
                pactId: id,
                userId,
                fromUserName: userName,
                habitName,
            },
        })).catch((err) => {
            logSpan({
                level: 'error',
                messageOrigin: 'API_SERVER',
                messages: ['Error creating pact join request notification'],
                traceArgs: { 'error.message': err?.message, pactId: id },
            });
        });

        sendEmailAndOrPushNotification(Store.users.findUser, req.headers, {
            authorization,
            fromUser: { id: userId, userName },
            locale,
            toUserId: pact.creatorUserId,
            type: PushNotifications.Types.pactJoinRequested,
            whiteLabelOrigin,
            brandVariation,
            pactId: id,
            habitName,
        }, {
            shouldSendPushNotification: true,
            shouldSendEmail: false,
        }).catch((err) => {
            logSpan({
                level: 'error',
                messageOrigin: 'API_SERVER',
                messages: ['Error sending pact join request notification'],
                traceArgs: { 'error.message': err?.message, pactId: id },
            });
        });

        return res.status(201).send(created);
    } catch (err: any) {
        return handleHttpError({ err, res, message: 'SQL:PACTS_ROUTES:ERROR' });
    }
};

// DELETE — the requester withdraws their own pending request.
const cancelJoinRequest: RequestHandler = async (req: any, res: any) => {
    const { locale, userId } = parseHeaders(req.headers);
    const { id } = req.params;

    try {
        const existing = await Store.pactJoinRequests.getPendingByPactAndRequester(id, userId);
        if (!existing) {
            return handleHttpError({
                res,
                message: translate(locale, 'errorMessages.pacts.joinRequestNotFound'),
                statusCode: 404,
                errorCode: ErrorCodes.NOT_FOUND,
            });
        }

        const cancelled = await Store.pactJoinRequests.resolvePending(existing.id, 'cancelled');
        return res.status(200).send(cancelled || existing);
    } catch (err: any) {
        return handleHttpError({ err, res, message: 'SQL:PACTS_ROUTES:ERROR' });
    }
};

/** Loads the pact and the request, and checks the caller is the pact's creator. */
const resolveCreatorRequest = async (req: any, res: any) => {
    const { locale, userId } = parseHeaders(req.headers);
    const { id, requestId } = req.params;

    const pact = await Store.pacts.getById(id);
    if (!pact) {
        notFound(res, locale);
        return null;
    }
    if (pact.creatorUserId !== userId) {
        handleHttpError({
            res,
            message: translate(locale, 'errorMessages.pacts.joinRequestCreatorOnly'),
            statusCode: 403,
            errorCode: ErrorCodes.NOT_PERMITTED,
        });
        return null;
    }

    if (!requestId) {
        return { pact, request: undefined };
    }

    const request = await Store.pactJoinRequests.getById(requestId);
    if (!request || request.pactId !== id || request.status !== 'pending') {
        handleHttpError({
            res,
            message: translate(locale, 'errorMessages.pacts.joinRequestNotFound'),
            statusCode: 404,
            errorCode: ErrorCodes.NOT_FOUND,
        });
        return null;
    }

    return { pact, request };
};

// READ — the creator's queue of pending requests on one pact.
const getPactJoinRequests: RequestHandler = async (req: any, res: any) => {
    try {
        const resolved = await resolveCreatorRequest(req, res);
        if (!resolved) {
            return undefined;
        }

        const requests = await Store.pactJoinRequests.getPendingByPact(resolved.pact.id);
        return res.status(200).send({ requests });
    } catch (err: any) {
        return handleHttpError({ err, res, message: 'SQL:PACTS_ROUTES:ERROR' });
    }
};

// UPDATE — the creator lets the requester in. From here they are an ordinary active member.
const approveJoinRequest: RequestHandler = async (req: any, res: any) => {
    const {
        locale,
        userId,
        userName,
        authorization,
        whiteLabelOrigin,
        brandVariation,
    } = parseHeaders(req.headers);

    try {
        const resolved = await resolveCreatorRequest(req, res);
        if (!resolved || !resolved.request) {
            return undefined;
        }
        const { pact, request } = resolved;
        const requesterUserId = request.requesterUserId;

        if (!isPactRunning(pact)) {
            return handleHttpError({
                res,
                message: translate(locale, 'errorMessages.pacts.notAcceptingMembers'),
                statusCode: 400,
                errorCode: ErrorCodes.BAD_REQUEST,
            });
        }

        const existingMember = await Store.pactMembers.getByPactAndUser(pact.id, requesterUserId);
        const alreadyIn = existingMember && (existingMember.status === 'active' || existingMember.status === 'pending');
        if (!alreadyIn && await Store.pacts.countSeats(pact.id) >= MAX_OPEN_PACT_MEMBERS) {
            return handleHttpError({
                res,
                message: translate(locale, 'errorMessages.pacts.notAcceptingMembers'),
                statusCode: 400,
                errorCode: ErrorCodes.BAD_REQUEST,
            });
        }

        // Checked against the requester, not the caller: it is their slot the join spends.
        if (!existingMember || existingMember.status !== 'active') {
            const capacityDenial = await checkHabitCapacity({ userId: requesterUserId, brandVariation, locale });
            if (capacityDenial) {
                return handleHttpError({
                    res,
                    message: translate(locale, 'errorMessages.pacts.joinRequesterAtCapacity'),
                    statusCode: 409,
                    errorCode: ErrorCodes.BAD_REQUEST,
                });
            }
        }

        // Claim the request before joining, so a double tap or a racing cancel resolves once.
        const claimed = await Store.pactJoinRequests.resolvePending(request.id, 'approved');
        if (!claimed) {
            return handleHttpError({
                res,
                message: translate(locale, 'errorMessages.pacts.joinRequestNotFound'),
                statusCode: 404,
                errorCode: ErrorCodes.NOT_FOUND,
            });
        }

        let updatedPact;
        try {
            if (!existingMember) {
                await Store.pactMembers.create({
                    pactId: pact.id,
                    userId: requesterUserId,
                    role: 'partner',
                    status: 'pending',
                });
            }
            updatedPact = await activatePactMembership(pact, requesterUserId);
        } catch (err) {
            await Store.pactJoinRequests.revertApproval(request.id).catch(() => undefined);
            throw err;
        }

        const habitGoal = await Store.habitGoals.getById(pact.habitGoalId).catch(() => undefined);
        sendEmailAndOrPushNotification(Store.users.findUser, req.headers, {
            authorization,
            fromUser: { id: userId, userName },
            locale,
            toUserId: requesterUserId,
            type: PushNotifications.Types.pactJoinApproved,
            whiteLabelOrigin,
            brandVariation,
            pactId: pact.id,
            habitName: habitGoal?.name || '',
        }, {
            shouldSendPushNotification: true,
            shouldSendEmail: false,
        }).catch((err) => {
            logSpan({
                level: 'error',
                messageOrigin: 'API_SERVER',
                messages: ['Error sending pact join approved notification'],
                traceArgs: { 'error.message': err?.message, pactId: pact.id },
            });
        });

        return res.status(200).send(updatedPact);
    } catch (err: any) {
        return handleHttpError({ err, res, message: 'SQL:PACTS_ROUTES:ERROR' });
    }
};

// UPDATE — the creator says no. Deliberately silent to the requester: their request simply stops
// being pending, and the open-pact list offers them the button again for other pacts.
const declineJoinRequest: RequestHandler = async (req: any, res: any) => {
    const { locale } = parseHeaders(req.headers);

    try {
        const resolved = await resolveCreatorRequest(req, res);
        if (!resolved || !resolved.request) {
            return undefined;
        }

        const declined = await Store.pactJoinRequests.resolvePending(resolved.request.id, 'declined');
        if (!declined) {
            return handleHttpError({
                res,
                message: translate(locale, 'errorMessages.pacts.joinRequestNotFound'),
                statusCode: 404,
                errorCode: ErrorCodes.NOT_FOUND,
            });
        }
        return res.status(200).send(declined);
    } catch (err: any) {
        return handleHttpError({ err, res, message: 'SQL:PACTS_ROUTES:ERROR' });
    }
};

export {
    getOpenPacts,
    setPactOpen,
    requestToJoinPact,
    cancelJoinRequest,
    getPactJoinRequests,
    approveJoinRequest,
    declineJoinRequest,
};
