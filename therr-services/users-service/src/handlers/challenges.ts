import { randomBytes } from 'crypto';
import { RequestHandler } from 'express';
import { BrandVariations, PushNotifications } from 'therr-js-utilities/constants';
import { parseHeaders } from 'therr-js-utilities/http';
import Store from '../store';
import { IChallengeDetailRow } from '../store/ChallengesStore';
import handleHttpError from '../utilities/handleHttpError';
import translate from '../utilities/translator';
import enqueueNotification from '../utilities/enqueueNotification';
import {
    CHALLENGE_DURATIONS_DAYS,
    DEFAULT_CHALLENGE_DURATION_DAYS,
    JOIN_TOKEN_RE,
    MAX_ACTIVE_CHALLENGES_PER_CREATOR,
    MAX_STANDINGS_LISTED,
    describeChallengeTiming,
    generateJoinToken,
    getChallengeEndDate,
    rankChallengeStandings,
} from '../utilities/challengeStandings';
import { checkHabitCapacity } from './helpers/habitCapacity';
import resolveWeekBounds from './helpers/weekBounds';

/**
 * Join-by-link challenges (WORK_IN_PROGRESS § 2.7, #2988).
 *
 * One person starts a challenge on a habit they track, shares habits.therr.com/c/<token>, and
 * anyone holding the link can join — from the app, or from the web without installing anything.
 * Each member keeps their own habit, streak and check-ins through `habits.user_habits`; the
 * challenge is only a scoreboard over those check-ins inside its date window.
 *
 * What a challenge deliberately does NOT do:
 *   - Notify members about each other's misses or check-ins. That is a pact's job, between 2–5
 *     people who chose each other. Strangers from a link pinging each other would be spam.
 *   - Count toward the solo-habit invite unlock. A public link is not a personal invite. It does
 *     count toward the referral reward, because the reward pays for new people who stay active.
 *   - Gate on the solo unlock. Joining a challenge is a social start; the habit-slot cap
 *     (`checkHabitCapacity`) still applies, so the free tier is unchanged.
 */

const utcToday = (): string => new Date().toISOString().slice(0, 10);

const getDisplayName = (firstName: string | null | undefined, userName: string) => (firstName || '').trim() || userName;

/**
 * The challenge as anyone with the link may see it. No user ids: a standings row is a public
 * username, a first name and a tally — the same things a public profile already shows.
 */
const serializeChallenge = async (
    challenge: IChallengeDetailRow,
    today: string,
    viewerUserId?: string,
) => {
    const isMeasured = !!challenge.goalAmountUnit;
    const tallies = await Store.challenges.getStandings(challenge);
    const ranked = rankChallengeStandings(tallies, isMeasured);
    const viewerRow = viewerUserId ? ranked.find((row) => row.userId === viewerUserId) : undefined;
    const timing = describeChallengeTiming(challenge.startDate, challenge.endDate, today);

    return {
        id: challenge.id,
        joinToken: challenge.joinToken,
        title: challenge.title || challenge.goalName,
        habitGoalId: challenge.habitGoalId,
        goal: {
            name: challenge.goalName,
            emoji: challenge.goalEmoji,
            amountUnit: challenge.goalAmountUnit,
        },
        creator: {
            userName: challenge.creatorUserName,
            displayName: getDisplayName(challenge.creatorFirstName, challenge.creatorUserName),
        },
        startDate: challenge.startDate,
        endDate: challenge.endDate,
        status: challenge.status === 'active' && timing.hasEnded ? 'ended' : challenge.status,
        ...timing,
        memberCount: challenge.activeMemberCount,
        maxMembers: challenge.maxMembers,
        isFull: challenge.activeMemberCount >= challenge.maxMembers,
        rankedBy: isMeasured ? 'amount' : 'checkinDays',
        standings: ranked.slice(0, MAX_STANDINGS_LISTED).map((row) => ({
            rank: row.rank,
            userName: row.userName,
            displayName: getDisplayName(row.firstName, row.userName),
            checkinDays: row.checkinDays,
            totalAmount: row.totalAmount,
            lastCheckinDate: row.lastCheckinDate,
        })),
        viewer: viewerUserId ? {
            isMember: !!viewerRow,
            isCreator: challenge.creatorUserId === viewerUserId,
            rank: viewerRow?.rank ?? null,
        } : null,
    };
};

const sendNotFound = (res: any, locale: string) => handleHttpError({
    res,
    message: translate(locale, 'errorMessages.challenges.notFound'),
    statusCode: 404,
});

// CREATE
const createChallenge: RequestHandler = async (req: any, res: any) => {
    const { locale, userId } = parseHeaders(req.headers);
    const { habitGoalId, title, timeZone } = req.body;
    const durationDays = req.body.durationDays === undefined
        ? DEFAULT_CHALLENGE_DURATION_DAYS
        : Number(req.body.durationDays);

    if (!habitGoalId) {
        return handleHttpError({
            res,
            message: translate(locale, 'errorMessages.habits.habitGoalRequired'),
            statusCode: 400,
        });
    }

    if (!CHALLENGE_DURATIONS_DAYS.includes(durationDays)) {
        return handleHttpError({
            res,
            message: translate(locale, 'errorMessages.challenges.invalidDuration', {
                allowed: CHALLENGE_DURATIONS_DAYS.join(', '),
            }),
            statusCode: 400,
        });
    }

    try {
        // A challenge is "come do what I'm doing", so the creator must be doing it. It also means
        // the creator is on the scoreboard from day one instead of an empty table.
        const tracking = await Store.userHabits.getByUserAndHabit(userId, habitGoalId);
        if (!tracking || tracking.status !== 'active') {
            return handleHttpError({
                res,
                message: translate(locale, 'errorMessages.challenges.notTrackingHabit'),
                statusCode: 400,
            });
        }

        const bounds = await resolveWeekBounds(userId, timeZone);
        const startDate = bounds?.today || utcToday();

        const activeCount = await Store.challenges.countActiveCreatedBy(userId, startDate);
        if (activeCount >= MAX_ACTIVE_CHALLENGES_PER_CREATOR) {
            return handleHttpError({
                res,
                message: translate(locale, 'errorMessages.challenges.tooManyActive', {
                    limit: MAX_ACTIVE_CHALLENGES_PER_CREATOR,
                }),
                statusCode: 400,
            });
        }

        const trimmedTitle = typeof title === 'string' ? title.trim().slice(0, 100) : '';
        const { id } = await Store.challenges.create({
            creatorUserId: userId,
            habitGoalId,
            title: trimmedTitle || null,
            joinToken: generateJoinToken(randomBytes),
            startDate,
            endDate: getChallengeEndDate(startDate, durationDays),
        });
        await Store.challenges.upsertActiveMember(id, userId);

        const challenge = await Store.challenges.getDetailById(id);
        return res.status(201).send(await serializeChallenge(challenge as IChallengeDetailRow, startDate, userId));
    } catch (err: any) {
        return handleHttpError({ err, res, message: 'SQL:CHALLENGES_ROUTES:ERROR' });
    }
};

// READ
const getMyChallenges: RequestHandler = async (req: any, res: any) => {
    const { userId } = parseHeaders(req.headers);

    try {
        const bounds = await resolveWeekBounds(userId, req.query?.timeZone);
        const today = bounds?.today || utcToday();
        const challenges = await Store.challenges.getDetailsForMember(userId);
        const serialized = await Promise.all(challenges.map((challenge) => serializeChallenge(challenge, today, userId)));

        return res.status(200).send({ challenges: serialized });
    } catch (err: any) {
        return handleHttpError({ err, res, message: 'SQL:CHALLENGES_ROUTES:ERROR' });
    }
};

/**
 * Public: the share link's page and the app's challenge screen both read this. Signed-in callers
 * (the gateway forwards x-userid when a token is present) also get `viewer`.
 */
const getChallengeByToken: RequestHandler = async (req: any, res: any) => {
    const { locale, userId } = parseHeaders(req.headers);
    const { token } = req.params;

    if (!JOIN_TOKEN_RE.test(token || '')) {
        return sendNotFound(res, locale);
    }

    try {
        const challenge = await Store.challenges.getDetailByToken(token);
        if (!challenge || challenge.status === 'cancelled') {
            return sendNotFound(res, locale);
        }

        const today = userId
            ? (await resolveWeekBounds(userId, req.query?.timeZone))?.today || utcToday()
            : utcToday();

        return res.status(200).send(await serializeChallenge(challenge, today, userId || undefined));
    } catch (err: any) {
        return handleHttpError({ err, res, message: 'SQL:CHALLENGES_ROUTES:ERROR' });
    }
};

// UPDATE
const joinChallenge: RequestHandler = async (req: any, res: any) => {
    const {
        locale,
        userId,
        userName,
        brandVariation,
    } = parseHeaders(req.headers);
    const { token } = req.params;

    if (!JOIN_TOKEN_RE.test(token || '')) {
        return sendNotFound(res, locale);
    }

    try {
        const challenge = await Store.challenges.getDetailByToken(token);
        if (!challenge || challenge.status === 'cancelled') {
            return sendNotFound(res, locale);
        }

        const bounds = await resolveWeekBounds(userId, req.body?.timeZone);
        const today = bounds?.today || utcToday();

        const existingMember = await Store.challenges.getMember(challenge.id, userId);
        const isAlreadyMember = existingMember?.status === 'active';

        if (!isAlreadyMember) {
            if (describeChallengeTiming(challenge.startDate, challenge.endDate, today).hasEnded) {
                return handleHttpError({
                    res,
                    message: translate(locale, 'errorMessages.challenges.ended'),
                    statusCode: 400,
                });
            }
            if (challenge.activeMemberCount >= challenge.maxMembers) {
                return handleHttpError({
                    res,
                    message: translate(locale, 'errorMessages.challenges.full'),
                    statusCode: 400,
                });
            }

            // Joining starts the habit, so it takes a slot like any other start. A habit the user
            // already tracks actively costs nothing — same rule as POST /habits/user-habits.
            const tracking = await Store.userHabits.getByUserAndHabit(userId, challenge.habitGoalId);
            if (tracking?.status !== 'active') {
                const denial = await checkHabitCapacity({
                    userId,
                    brandVariation: brandVariation || BrandVariations.HABITS,
                    locale,
                    countsAsStart: tracking?.status !== 'archived',
                });
                if (denial) {
                    return res.status(402).send(denial);
                }
            }

            const userHabit = await Store.userHabits.getOrCreate(userId, challenge.habitGoalId);
            if (userHabit.status === 'archived') {
                await Store.userHabits.setStatus(userHabit.id, userId, 'active');
            }
            await Store.streaks.getOrCreate(userId, challenge.habitGoalId);
        }

        const { wasJustJoined } = await Store.challenges.upsertActiveMember(challenge.id, userId);

        if (wasJustJoined && challenge.creatorUserId !== userId) {
            // Queued, not sent inline: it is not something the creator is waiting on, and the
            // dedupe key makes a leave-and-rejoin announce once.
            enqueueNotification({
                brandVariation: BrandVariations.HABITS,
                toUserId: challenge.creatorUserId,
                type: PushNotifications.Types.challengeJoined,
                dedupeKey: `challenge-joined:${challenge.id}:${userId}`,
                // Field names are the ones sendEmailAndOrPushNotification forwards to the push
                // service; anything else in a queue payload is dropped on the way.
                payload: {
                    fromUser: { id: userId, userName },
                    habitName: challenge.title || challenge.goalName,
                },
            });
        }

        const refreshed = await Store.challenges.getDetailById(challenge.id);
        return res.status(wasJustJoined ? 201 : 200)
            .send(await serializeChallenge(refreshed as IChallengeDetailRow, today, userId));
    } catch (err: any) {
        return handleHttpError({ err, res, message: 'SQL:CHALLENGES_ROUTES:ERROR' });
    }
};

/**
 * Leave a challenge. The habit stays tracked — leaving a scoreboard is not quitting the habit,
 * and archiving is one tap away if that is what they meant.
 */
const leaveChallenge: RequestHandler = async (req: any, res: any) => {
    const { locale, userId } = parseHeaders(req.headers);

    try {
        const challenge = await Store.challenges.getDetailById(req.params.id);
        if (!challenge) {
            return sendNotFound(res, locale);
        }
        if (challenge.creatorUserId === userId) {
            return handleHttpError({
                res,
                message: translate(locale, 'errorMessages.challenges.creatorCannotLeave'),
                statusCode: 400,
            });
        }

        await Store.challenges.setMemberStatus(challenge.id, userId, 'left');
        return res.status(200).send({ left: true });
    } catch (err: any) {
        return handleHttpError({ err, res, message: 'SQL:CHALLENGES_ROUTES:ERROR' });
    }
};

/** The creator ends a challenge for everyone. The link stops working; habits stay tracked. */
const cancelChallenge: RequestHandler = async (req: any, res: any) => {
    const { locale, userId } = parseHeaders(req.headers);

    try {
        const challenge = await Store.challenges.getDetailById(req.params.id);
        if (!challenge) {
            return sendNotFound(res, locale);
        }
        if (challenge.creatorUserId !== userId) {
            return handleHttpError({
                res,
                message: translate(locale, 'errorMessages.challenges.notCreator'),
                statusCode: 403,
            });
        }

        await Store.challenges.setStatus(challenge.id, 'cancelled');
        return res.status(200).send({ cancelled: true });
    } catch (err: any) {
        return handleHttpError({ err, res, message: 'SQL:CHALLENGES_ROUTES:ERROR' });
    }
};

export {
    createChallenge,
    getMyChallenges,
    getChallengeByToken,
    joinChallenge,
    leaveChallenge,
    cancelChallenge,
};
