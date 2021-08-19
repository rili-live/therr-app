import { RequestHandler } from 'express';
import { ErrorCodes } from 'therr-js-utilities/constants';
import printLogs from 'therr-js-utilities/print-logs';
import beeline from '../beeline';
import handleHttpError from '../utilities/handleHttpError';
import Store from '../store';
import sendSubscriberVerificationEmail from '../api/email/sendSubscriberVerificationEmail';

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

            return Store.subscribers.createSubscriber(req.body).then((subscribers) => {
                sendSubscriberVerificationEmail({
                    subject: '[Therr] Subscribed to General Updates',
                    toAddresses: [req.body.email],
                }, {}).catch((error) => {
                    printLogs({
                        level: 'error',
                        messageOrigin: 'API_SERVER',
                        messages: [`New subscriber email notification failed for ${req.body.email}`, error?.message],
                        tracer: beeline,
                        traceArgs: {
                            userEmail: req.body.email,
                        },
                    });
                });

                return res.status(201).send(subscribers[0]);
            });
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
