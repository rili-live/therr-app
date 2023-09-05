import { RequestHandler } from 'express';
import { ErrorCodes } from 'therr-js-utilities/constants';
import logSpan from 'therr-js-utilities/log-or-update-span';
import handleHttpError from '../utilities/handleHttpError';
import Store from '../store';
import sendUserFeedbackEmail from '../api/email/admin/sendUserFeedbackEmail';
import sendSubscriberVerificationEmail from '../api/email/sendSubscriberVerificationEmail';

// CREATE
const createFeedback: RequestHandler = (req: any, res: any) => {
    const fromUserId = req.headers['x-userid'];
    return sendUserFeedbackEmail({
        subject: '[Therr] New User Feedback',
        toAddresses: [process.env.AWS_FEEDBACK_EMAIL_ADDRESS as any],
    }, {
        fromUserId,
        feedback: req.body.feedback,
    }).catch((error) => {
        logSpan({
            level: 'error',
            messageOrigin: 'API_SERVER',
            messages: ['Feedback message email failed', error?.message],
            traceArgs: {
                'user.email': req.body.email,
            },
        });
    }).then(() => res.status(201).send()).catch((err) => handleHttpError({
        err,
        res,
        message: 'SQL:USER_ROUTES:ERROR',
    }));
};

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
                    logSpan({
                        level: 'error',
                        messageOrigin: 'API_SERVER',
                        messages: [`New subscriber email notification failed for ${req.body.email}`, error?.message],
                        traceArgs: {
                            'user.email': req.body.email,
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
    createFeedback,
    createSubscriber,
};
