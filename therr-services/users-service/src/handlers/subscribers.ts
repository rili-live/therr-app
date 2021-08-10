import { RequestHandler } from 'express';
import { ErrorCodes } from 'therr-js-utilities/constants';
import handleHttpError from '../utilities/handleHttpError';
import Store from '../store';

// CREATE
const createSubscriber: RequestHandler = (req: any, res: any) => {
    if (!req.body.email) {
        return handleHttpError({
            res,
            message: 'E-mail is a required field',
            statusCode: 400,
            errorCode: ErrorCodes.UNKNOWN_ERROR,
        });
    }

    return Store.subscribers.findSubscriber(req.body)
        .then((findResults) => {
            if (findResults.length) {
                return handleHttpError({
                    res,
                    message: 'A subscription with this e-mail already exists',
                    statusCode: 400,
                    errorCode: ErrorCodes.USER_EXISTS,
                });
            }

            return Store.subscribers.createSubscriber(req.body).then((subscribers) => res.status(201).send(subscribers[0]));
        })
        .catch((err) => handleHttpError({
            err,
            res,
            message: 'SQL:USER_ROUTES:ERROR',
        }));
};

export {
    createSubscriber,
};
