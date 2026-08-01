import { RequestHandler } from 'express';
import { parseHeaders } from 'therr-js-utilities/http';
import logSpan from 'therr-js-utilities/log-or-update-span';
import {
    IDENTITY_REFLECTION_PROMPTS,
    IdentityReflectionTypes,
    IdentityStages,
    SELF_CONCEPT_MAX_SCORE,
    SELF_CONCEPT_MIN_SCORE,
    evaluateIdentityStage,
} from 'therr-js-utilities/config';
import Store from '../store';
import handleHttpError from '../utilities/handleHttpError';
import translate from '../utilities/translator';
import { getIdentitySnapshot } from './helpers/identityProgress';
import {
    buildIdentityEvidence,
    getDaysSinceLastVote,
} from '../utilities/identityHelpers';
import { getPartnerUserId } from '../utilities/pactHelpers';

const MAX_IDENTITY_LABEL_LENGTH = 120;
const MAX_REFLECTION_TEXT_LENGTH = 2000;

const REFLECTION_TYPE_VALUES: string[] = Object.values(IdentityReflectionTypes);

/**
 * Every identity the user is building.
 *
 * Returns stored stages without re-evaluating each one. Re-evaluation needs three
 * aggregate queries per habit, and this list is a navigation surface — the detail
 * endpoint recomputes when the user opens a habit, and a check-in recomputes on
 * write, so the only staleness possible here is a rung the user has already
 * earned but not yet seen.
 */
const getUserIdentities: RequestHandler = async (req: any, res: any) => {
    const { userId } = parseHeaders(req.headers);

    return Store.identityProgress.getByUserId(userId)
        .then((identities) => res.status(200).send(identities))
        .catch((err) => handleHttpError({ err, res, message: 'SQL:HABIT_IDENTITY_ROUTES:ERROR' }));
};

/**
 * Full identity state for one habit: stored row, freshly evaluated stage, the
 * requirements for the next rung, and whether the habit has gone dormant.
 */
const getIdentityByHabit: RequestHandler = async (req: any, res: any) => {
    const { locale, userId } = parseHeaders(req.headers);
    const { habitGoalId } = req.params;

    const habitGoal = await Store.habitGoals.getById(habitGoalId);
    if (!habitGoal) {
        return handleHttpError({
            res,
            message: translate(locale, 'errorMessages.identity.habitNotFound'),
            statusCode: 404,
        });
    }

    return getIdentitySnapshot(userId, habitGoalId, habitGoal)
        .then((snapshot) => {
            // No row yet: the user has never named an identity or checked in for
            // this habit. Return the empty ladder rather than a 404 so the client
            // can render the "name who you're becoming" prompt from one response.
            if (!snapshot) {
                const evidence = buildIdentityEvidence({
                    progress: {},
                    habitGoal,
                    completedInWindow: 0,
                    distinctWeeksActive: 0,
                    recentDifficultyRatings: [],
                });
                return res.status(200).send({
                    progress: null,
                    evaluation: evaluateIdentityStage(evidence, IdentityStages.INTENTION),
                    isDormant: false,
                    daysSinceLastVote: null,
                });
            }

            return res.status(200).send(snapshot);
        })
        .catch((err) => handleHttpError({ err, res, message: 'SQL:HABIT_IDENTITY_ROUTES:ERROR' }));
};

/**
 * Name (or rename) the identity this habit is a vote for.
 *
 * This is the entry point to the whole ladder — `hasIdentityLabel` gates the first
 * rung — so it creates the progress row when there isn't one, rather than making
 * the client check in first.
 */
const setIdentityLabel: RequestHandler = async (req: any, res: any) => {
    const { locale, userId } = parseHeaders(req.headers);
    const { habitGoalId } = req.params;
    const { identityLabel, pactId } = req.body;

    const trimmedLabel = typeof identityLabel === 'string' ? identityLabel.trim() : '';
    if (!trimmedLabel) {
        return handleHttpError({
            res,
            message: translate(locale, 'errorMessages.identity.labelRequired'),
            statusCode: 400,
        });
    }

    if (trimmedLabel.length > MAX_IDENTITY_LABEL_LENGTH) {
        return handleHttpError({
            res,
            message: translate(locale, 'errorMessages.identity.labelTooLong', { max: MAX_IDENTITY_LABEL_LENGTH }),
            statusCode: 400,
        });
    }

    const habitGoal = await Store.habitGoals.getById(habitGoalId);
    if (!habitGoal) {
        return handleHttpError({
            res,
            message: translate(locale, 'errorMessages.identity.habitNotFound'),
            statusCode: 404,
        });
    }

    return Store.identityProgress.getOrCreate(userId, habitGoalId, pactId)
        .then((progress) => Store.identityProgress.setIdentityLabel(progress.id, trimmedLabel))
        .then(async (progress) => {
            // Naming the identity can itself complete the first rung for a user who
            // already had check-ins, so re-evaluate instead of waiting for the next
            // check-in to notice.
            const snapshot = await getIdentitySnapshot(userId, habitGoalId, habitGoal);
            if (snapshot) {
                const advanced = await Store.identityProgress.applyStage(snapshot.progress, snapshot.evaluation.stage);
                return res.status(200).send({ ...snapshot, progress: advanced || snapshot.progress });
            }
            return res.status(200).send({
                progress, evaluation: null, isDormant: false, daysSinceLastVote: null,
            });
        })
        .catch((err) => handleHttpError({ err, res, message: 'SQL:HABIT_IDENTITY_ROUTES:ERROR' }));
};

/**
 * Confirm the author may write a partner affirmation about `targetUserId` for this
 * habit — they must share a pact on it. Returns the pact when allowed, null when
 * not, so callers can attach the affirmation to the pact's activity feed.
 */
const findSharedPactForHabit = async (
    authorUserId: string,
    targetUserId: string,
    habitGoalId: string,
) => {
    const pacts = await Store.pacts.getActivePactsByUserId(authorUserId);
    return pacts.find((pact: any) => pact.habitGoalId === habitGoalId
        && getPartnerUserId(authorUserId, pact.creatorUserId, pact.partnerUserId) === targetUserId) || null;
};

/**
 * Record a reflection — the mindset layer's evidence.
 *
 * Two shapes go through here. A self-reflection is written by the habit's owner
 * about their own habit. A partner affirmation is written by the pact partner
 * ABOUT the owner, and is the only evidence that can satisfy the top rung: the
 * point is that identity is confirmed from outside, so it deliberately cannot be
 * self-issued.
 */
const createReflection: RequestHandler = async (req: any, res: any) => {
    const { locale, userId } = parseHeaders(req.headers);
    const { habitGoalId } = req.params;
    const {
        reflectionType,
        responseScore,
        responseText,
        checkinId,
        targetUserId,
    } = req.body;

    if (!REFLECTION_TYPE_VALUES.includes(reflectionType)) {
        return handleHttpError({
            res,
            message: translate(locale, 'errorMessages.identity.invalidReflectionType'),
            statusCode: 400,
        });
    }

    const habitGoal = await Store.habitGoals.getById(habitGoalId);
    if (!habitGoal) {
        return handleHttpError({
            res,
            message: translate(locale, 'errorMessages.identity.habitNotFound'),
            statusCode: 404,
        });
    }

    const isPartnerAffirmation = reflectionType === IdentityReflectionTypes.PARTNER_AFFIRMATION;
    // Whose identity this is evidence for. For an affirmation that is the partner
    // being affirmed, not the author.
    const subjectUserId = isPartnerAffirmation ? targetUserId : userId;
    // `any`: pact rows come back untyped from the store, as elsewhere in this service.
    let sharedPact: any = null;

    if (isPartnerAffirmation) {
        if (!subjectUserId || subjectUserId === userId) {
            return handleHttpError({
                res,
                message: translate(locale, 'errorMessages.identity.affirmationRequiresPartner'),
                statusCode: 400,
            });
        }

        sharedPact = await findSharedPactForHabit(userId, subjectUserId, habitGoalId);
        if (!sharedPact) {
            return handleHttpError({
                res,
                message: translate(locale, 'errorMessages.identity.affirmationNotPermitted'),
                statusCode: 403,
            });
        }
    }

    const isScalePrompt = IDENTITY_REFLECTION_PROMPTS[reflectionType]?.responseFormat === 'scale';
    const parsedScore = Number(responseScore);
    if (isScalePrompt) {
        if (!Number.isInteger(parsedScore)
            || parsedScore < SELF_CONCEPT_MIN_SCORE
            || parsedScore > SELF_CONCEPT_MAX_SCORE) {
            return handleHttpError({
                res,
                message: translate(locale, 'errorMessages.identity.invalidScore', {
                    min: SELF_CONCEPT_MIN_SCORE,
                    max: SELF_CONCEPT_MAX_SCORE,
                }),
                statusCode: 400,
            });
        }
    } else if (typeof responseText !== 'string' || !responseText.trim()) {
        return handleHttpError({
            res,
            message: translate(locale, 'errorMessages.identity.responseRequired'),
            statusCode: 400,
        });
    }

    const trimmedText = typeof responseText === 'string'
        ? responseText.trim().slice(0, MAX_REFLECTION_TEXT_LENGTH)
        : undefined;

    return Store.identityProgress.getOrCreate(subjectUserId, habitGoalId, sharedPact?.id)
        .then(async (progress) => {
            await Store.identityReflections.create({
                identityProgressId: progress.id,
                userId: subjectUserId,
                habitGoalId,
                authorUserId: userId,
                checkinId,
                reflectionType,
                promptKey: IDENTITY_REFLECTION_PROMPTS[reflectionType]?.promptKey || reflectionType,
                responseScore: isScalePrompt ? parsedScore : undefined,
                responseText: isScalePrompt ? undefined : trimmedText,
            });

            if (isPartnerAffirmation) {
                await Store.identityProgress.incrementCounter(progress.id, 'partnerAffirmationCount');
            } else {
                await Store.identityProgress.incrementCounter(progress.id, 'reflectionCount');
            }

            if (isScalePrompt) {
                await Store.identityProgress.recordSelfConceptScore(progress.id, parsedScore);
            }

            const snapshot = await getIdentitySnapshot(subjectUserId, habitGoalId, habitGoal);
            if (!snapshot) {
                return res.status(201).send({ progress, evaluation: null });
            }

            const advanced = await Store.identityProgress.applyStage(snapshot.progress, snapshot.evaluation.stage);
            if (advanced && snapshot.evaluation.stage === IdentityStages.IDENTITY && !snapshot.progress.identityConfirmedAt) {
                await Store.identityProgress.markIdentityConfirmed(snapshot.progress.id);
            }

            // Surface the affirmation in the pact feed — an affirmation nobody sees
            // isn't a witness. Non-fatal: the reflection itself is already saved.
            if (isPartnerAffirmation && sharedPact) {
                await Store.pactActivities.create({
                    pactId: sharedPact.id,
                    userId,
                    targetUserId: subjectUserId,
                    activityType: 'identity_affirmed',
                    data: { habitGoalId, identityLabel: snapshot.progress.identityLabel },
                }).catch((err) => {
                    logSpan({
                        level: 'warn',
                        messageOrigin: 'API_SERVER',
                        messages: ['Failed to record identity affirmation activity'],
                        traceArgs: { 'error.message': err?.message, pactId: sharedPact.id },
                    });
                });
            }

            return res.status(201).send({ ...snapshot, progress: advanced || snapshot.progress });
        })
        .catch((err) => handleHttpError({ err, res, message: 'SQL:HABIT_IDENTITY_ROUTES:ERROR' }));
};

/**
 * The reflection timeline for a habit — the user's own words, oldest answers
 * included. Re-reading the WHY answer during a lapse is the point.
 */
const getReflections: RequestHandler = async (req: any, res: any) => {
    const { userId } = parseHeaders(req.headers);
    const { habitGoalId } = req.params;
    const { limit } = req.query;

    return Store.identityProgress.getByUserAndHabit(userId, habitGoalId)
        .then((progress) => {
            if (!progress) {
                return res.status(200).send([]);
            }
            return Store.identityReflections
                .getByIdentityProgressId(progress.id, limit ? parseInt(limit, 10) : 50)
                .then((reflections) => res.status(200).send(reflections));
        })
        .catch((err) => handleHttpError({ err, res, message: 'SQL:HABIT_IDENTITY_ROUTES:ERROR' }));
};

/**
 * A partner's identity progress for a habit they share a pact on.
 *
 * Read-only and deliberately narrow: it exists so the partner can see what to
 * affirm. Counters and label only — reflections stay private to their author.
 */
const getPartnerIdentity: RequestHandler = async (req: any, res: any) => {
    const { locale, userId } = parseHeaders(req.headers);
    const { habitGoalId, partnerUserId } = req.params;

    const sharedPact = await findSharedPactForHabit(userId, partnerUserId, habitGoalId);
    if (!sharedPact) {
        return handleHttpError({
            res,
            message: translate(locale, 'errorMessages.identity.affirmationNotPermitted'),
            statusCode: 403,
        });
    }

    return Store.identityProgress.getByUserAndHabit(partnerUserId, habitGoalId)
        .then((progress) => {
            if (!progress) {
                return res.status(200).send(null);
            }
            return res.status(200).send({
                userId: progress.userId,
                habitGoalId: progress.habitGoalId,
                identityLabel: progress.identityLabel,
                stage: progress.stage,
                votesCast: progress.votesCast,
                partnerAffirmationCount: progress.partnerAffirmationCount,
                lastVoteDate: progress.lastVoteDate,
                daysSinceLastVote: getDaysSinceLastVote(progress.lastVoteDate),
            });
        })
        .catch((err) => handleHttpError({ err, res, message: 'SQL:HABIT_IDENTITY_ROUTES:ERROR' }));
};

export {
    getUserIdentities,
    getIdentityByHabit,
    setIdentityLabel,
    createReflection,
    getReflections,
    getPartnerIdentity,
};
