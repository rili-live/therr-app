import { RequestHandler } from 'express';
import { BrandVariations, ErrorCodes } from 'therr-js-utilities/constants';
import logSpan from 'therr-js-utilities/log-or-update-span';
import { parseHeaders } from 'therr-js-utilities/http';
import handleHttpError from '../utilities/handleHttpError';
import { getHostContext } from '../constants/hostContext';
import Store from '../store';
import sendUserFeedbackEmail from '../api/email/admin/sendUserFeedbackEmail';
import sendSubscriberVerificationEmail from '../api/email/sendSubscriberVerificationEmail';
import { redactUserCreds } from './helpers/user';

// READ
const getSubscriptionSettings: RequestHandler = (req: any, res: any) => {
    const {
        userId,
        whiteLabelOrigin,
        brandVariation,
    } = parseHeaders(req.headers);

    return Store.users.findUser({
        id: userId,
    }, [
        'email',
        'settingsEmailMarketing',
        'settingsEmailBusMarketing',
        'settingsEmailBackground',
        'settingsEmailInvites',
        'settingsEmailLikes',
        'settingsEmailMentions',
        'settingsEmailMessages',
        'settingsEmailReminders',
    ]).then(([user]) => {
        if (!user) {
            return handleHttpError({
                res,
                message: 'User not found',
                statusCode: 404,
                errorCode: ErrorCodes.NOT_FOUND,
            });
        }

        redactUserCreds(user);

        return res.status(200).send({
            id: userId,
            email: user.email,
            settingsEmailMarketing: user.settingsEmailMarketing,
            settingsEmailBusMarketing: user.settingsEmailBusMarketing,
            settingsEmailBackground: user.settingsEmailBackground,
            settingsEmailInvites: user.settingsEmailInvites,
            settingsEmailLikes: user.settingsEmailLikes,
            settingsEmailMentions: user.settingsEmailMentions,
            settingsEmailMessages: user.settingsEmailMessages,
            settingsEmailReminders: user.settingsEmailReminders,
        });
    }).catch((err) => handleHttpError({
        err,
        res,
        message: 'SQL:USER_ROUTES:ERROR',
    }));
};

// CREATE
const createFeedback: RequestHandler = (req: any, res: any) => {
    const {
        userId: fromUserId,
        whiteLabelOrigin,
        brandVariation,
    } = parseHeaders(req.headers);

    return sendUserFeedbackEmail({
        subject: '[Therr] New User Feedback',
        toAddresses: [process.env.AWS_FEEDBACK_EMAIL_ADDRESS as any],
        agencyDomainName: whiteLabelOrigin,
        brandVariation,
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
    const {
        locale,
        whiteLabelOrigin,
        brandVariation,
    } = parseHeaders(req.headers);

    if (!req.body.email) {
        return handleHttpError({
            res,
            message: 'E-mail is a required field',
            statusCode: 400,
            errorCode: ErrorCodes.UNKNOWN_ERROR,
        });
    }

    const { email } = req.body;
    // Coerced rather than trusted: the gateway forwards the body verbatim and the signup
    // route runs its validation chain without `validate`, so anything could arrive here.
    const isSubscribedToIosWaitlist = req.body.isSubscribedToIosWaitlist === true
        || req.body.isSubscribedToIosWaitlist === 'true';
    const resolvedBrand = brandVariation || BrandVariations.THERR;
    const contextConfig = getHostContext(whiteLabelOrigin, resolvedBrand);

    return Store.subscribers.findSubscriber({ email })
        .then((findResults) => {
            if (findResults.length) {
                // An address already on the general list that now asks for the iOS
                // announcement is an upgrade, not a duplicate. Rejecting it (which is still
                // what a plain re-subscribe gets, so the therr-landing signup form's
                // behaviour is unchanged) would throw away the only demand signal the
                // waitlist exists to collect.
                if (isSubscribedToIosWaitlist && !findResults[0].isSubscribedToIosWaitlist) {
                    return Store.subscribers.updateSubscriber({
                        isSubscribedToIosWaitlist: true,
                    }, { email }).then(([updatedSubscriber]) => res.status(200).send(updatedSubscriber));
                }

                if (isSubscribedToIosWaitlist) {
                    // Already on the waitlist. Idempotent success so a double submit reads as
                    // "you're on the list" rather than an error.
                    return res.status(200).send(findResults[0]);
                }

                return handleHttpError({
                    res,
                    message: 'A subscription with this e-mail already exists',
                    statusCode: 400,
                    errorCode: ErrorCodes.USER_EXISTS,
                });
            }

            return Store.subscribers.createSubscriber({
                email,
                brandVariation: resolvedBrand,
                isSubscribedToIosWaitlist,
            }).then((subscribers) => {
                sendSubscriberVerificationEmail({
                    subject: `[${contextConfig.brandName}] Subscribed to General Updates`,
                    locale,
                    toAddresses: [email],
                    agencyDomainName: whiteLabelOrigin,
                    brandVariation,
                }, {}).catch((error) => {
                    logSpan({
                        level: 'error',
                        messageOrigin: 'API_SERVER',
                        messages: [`New subscriber email notification failed for ${email}`, error?.message],
                        traceArgs: {
                            'user.email': email,
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

const updateSubscriptions: RequestHandler = (req: any, res: any) => {
    const {
        userId,
        whiteLabelOrigin,
        brandVariation,
    } = parseHeaders(req.headers);

    const {
        email,
        settingsEmailMarketing,
        settingsEmailBackground,
        settingsEmailInvites,
        settingsEmailLikes,
        settingsEmailMentions,
        settingsEmailMessages,
        settingsEmailReminders,
        settingsEmailBusMarketing,
    } = req.body;

    if (!email) {
        return handleHttpError({
            res,
            message: 'E-mail is a required field',
            statusCode: 400,
            errorCode: ErrorCodes.UNKNOWN_ERROR,
        });
    }

    return Store.users.updateUser({
        settingsEmailMarketing,
        settingsEmailBusMarketing,
        settingsEmailBackground,
        settingsEmailInvites,
        settingsEmailLikes,
        settingsEmailMentions,
        settingsEmailMessages,
        settingsEmailReminders,
    }, {
        id: userId,
        email,
    }).then(([updatedUser]) => {
        if (!updatedUser) {
            return handleHttpError({
                res,
                message: 'User not found',
                statusCode: 404,
                errorCode: ErrorCodes.NOT_FOUND,
            });
        }

        redactUserCreds(updatedUser);

        return res.status(201).send({
            message: 'E-mail preferences successfully updated',
            result: {
                settingsEmailMarketing: updatedUser.settingsEmailMarketing,
                settingsEmailBusMarketing: updatedUser.settingsEmailBusMarketing,
                settingsEmailBackground: updatedUser.settingsEmailBackground,
                settingsEmailInvites: updatedUser.settingsEmailInvites,
                settingsEmailLikes: updatedUser.settingsEmailLikes,
                settingsEmailMentions: updatedUser.settingsEmailMentions,
                settingsEmailMessages: updatedUser.settingsEmailMessages,
                settingsEmailReminders: updatedUser.settingsEmailReminders,
            },
        });
    }).catch((err) => handleHttpError({
        err,
        res,
        message: 'SQL:USER_ROUTES:ERROR',
    }));
};

export {
    getSubscriptionSettings,
    createFeedback,
    createSubscriber,
    updateSubscriptions,
};
