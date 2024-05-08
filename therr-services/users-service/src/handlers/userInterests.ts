// import { ErrorCodes } from 'therr-js-utilities/constants';
// import logSpan from 'therr-js-utilities/log-or-update-span';
import { parseHeaders } from 'therr-js-utilities/http';
import handleHttpError from '../utilities/handleHttpError';
// import translate from '../utilities/translator';
import Store from '../store';

// CREATE
const createUpdateUserInterests = async (req, res) => {
    const {
        authorization,
        locale,
        userId,
        whiteLabelOrigin,
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

export {
    createUpdateUserInterests,
    getUserInterests,
};
