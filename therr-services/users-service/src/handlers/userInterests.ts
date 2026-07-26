// import { ErrorCodes } from 'therr-js-utilities/constants';
// import logSpan from 'therr-js-utilities/log-or-update-span';
import { parseHeaders } from 'therr-js-utilities/http';
import handleHttpError from '../utilities/handleHttpError';
// import translate from '../utilities/translator';
import Store from '../store';

// Upper bound on how much a single flush may add to one interest's engagement count.
const MAX_COALESCED_INCREMENT = 25;

// CREATE
const createUpdateUserInterests = async (req, res) => {
    const {
        authorization,
        locale,
        userId,
        whiteLabelOrigin,
        brandVariation,
    } = parseHeaders(req.headers);

    const {
        interests,
    } = req.body;

    const userInterests = interests?.map((i) => ({
        userId,
        interestId: i.interestId,
        isEnabled: i.isEnabled,
        score: i.score,
    }));

    if (!userInterests) {
        return handleHttpError({
            statusCode: 400,
            res,
            message: 'SQL:USER_INTERESTS_ROUTES:ERROR',
        });
    }

    return Store.userInterests.create(userInterests)
        .then((results) => res.status(200).send(results))
        .catch((err) => handleHttpError({
            err,
            res,
            message: 'SQL:USER_INTERESTS_ROUTES:ERROR',
        }));
};

// READ
const getUserInterests = (req, res) => {
    const {
        authorization,
        locale,
        userId,
        whiteLabelOrigin,
        brandVariation,
    } = parseHeaders(req.headers);

    const isMeRoute = req.path.includes('/me');

    const contextUserId = isMeRoute ? userId : req.params.userId || userId;

    return Store.userInterests.getByUserId(contextUserId)
        .then((results) => res.status(200).send(results))
        .catch((err) => handleHttpError({
            err,
            res,
            message: 'SQL:USER_INTERESTS_ROUTES:ERROR',
        }));
};

const incrementUserInterests = (req, res) => {
    const {
        authorization,
        locale,
        userId,
        whiteLabelOrigin,
        brandVariation,
    } = parseHeaders(req.headers);

    if (!userId) {
        return res.status(200).send({
            message: 'Missing user ID',
        });
    }

    const {
        incrBy,
        interestDisplayNameKeys,
        interestIncrements,
    } = req.body;

    // `interestIncrements` ({ displayNameKey: amount }) is the coalesced shape sent by
    // callers that buffer a user's engagement before flushing. `interestDisplayNameKeys` +
    // `incrBy` is the original one-event-at-a-time shape, still accepted so a rolling
    // deploy where an older maps/reactions pod is still running keeps working.
    if (interestIncrements && typeof interestIncrements === 'object') {
        const cappedIncrements = Object.keys(interestIncrements).reduce((acc, key) => ({
            ...acc,
            // Per-key ceiling on a single flush. The old per-event cap was 5; a flush
            // aggregates many events, so this is looser but still bounded.
            [key]: Math.min(MAX_COALESCED_INCREMENT, Number(interestIncrements[key]) || 0),
        }), {});

        return Store.userInterests
            .incrementUserInterestsByKey(userId, cappedIncrements)
            .then((results) => res.status(200).send(results[0]))
            .catch((err) => handleHttpError({ err, res, message: 'SQL:USER_INTERESTS_ROUTES:ERROR' }));
    }

    const ceilIncrBy = Math.min(5, (incrBy || 1));

    return Store.userInterests
        .incrementUserInterests(userId, interestDisplayNameKeys, ceilIncrBy)
        .then((results) => res.status(200).send(results[0]))
        .catch((err) => handleHttpError({ err, res, message: 'SQL:USER_INTERESTS_ROUTES:ERROR' }));
};

export {
    createUpdateUserInterests,
    getUserInterests,
    incrementUserInterests,
};
