import { RequestHandler } from 'express';
import { BrandVariations, ErrorCodes } from 'therr-js-utilities/constants';
import logSpan from 'therr-js-utilities/log-or-update-span';
import { parseHeaders } from 'therr-js-utilities/http';
import handleHttpError from '../utilities/handleHttpError';
import { getHostContext } from '../constants/hostContext';
import Store from '../store';
import { ICreateSubscriberParams } from '../store/SubscribersStore';
import sendUserFeedbackEmail from '../api/email/admin/sendUserFeedbackEmail';
import sendSubscriberVerificationEmail from '../api/email/sendSubscriberVerificationEmail';
import sendCoachesWaitlistAdminEmail from '../api/email/admin/sendCoachesWaitlistAdminEmail';
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

/**
 * The answers the habits.therr.com/coaches waitlist form may send, and the only values stored.
 * The option values in therr-client-web/src/views/habits/coaches.hbs must match these; its test
 * (habitsCoachesLanding.test.ts) pins the same lists.
 *
 * monthlyBudget is bucketed around $20 on purpose: the go/no-go for building the coach view is
 * roughly ten coaches saying they would pay at least that.
 */
export const COACHES_WAITLIST_ANSWERS: Record<string, readonly string[]> = {
    coachingType: ['nutrition', 'fitness', 'wellness', 'adhd', 'life-business', 'other'],
    clientCount: ['1-5', '6-15', '16-40', '41-plus'],
    monthlyBudget: ['under-20', '20-40', '40-plus', 'unsure'],
};

/**
 * Keeps only whitelisted answers. The gateway proxies the body verbatim, so anything could
 * arrive here; an unknown key or value is dropped rather than rejected, because losing a coach's
 * email over a malformed optional answer would cost the one thing the form exists to collect.
 */
export const sanitizeCoachesWaitlistDetails = (raw: unknown): Record<string, string> => {
    const details: Record<string, string> = {};
    if (!raw || typeof raw !== 'object') {
        return details;
    }
    Object.keys(COACHES_WAITLIST_ANSWERS).forEach((key) => {
        const value = (raw as Record<string, unknown>)[key];
        if (typeof value === 'string' && COACHES_WAITLIST_ANSWERS[key].includes(value)) {
            details[key] = value;
        }
    });
    return details;
};

/**
 * What a signup answers with. The endpoint is unauthenticated and keyed on an email address the
 * caller types, so it must not echo the stored row: for an existing address that would hand
 * anyone who knows it which lists it is on and a coach's waitlist answers. No client reads more
 * than the status code (and `message` on an error).
 */
const toSignupResponse = (email: string) => ({ email });

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
    // Coerced rather than trusted: the gateway forwards the body verbatim, so anything could
    // arrive here.
    const isSubscribedToIosWaitlist = req.body.isSubscribedToIosWaitlist === true
        || req.body.isSubscribedToIosWaitlist === 'true';
    const isSubscribedToCoachesWaitlist = req.body.isSubscribedToCoachesWaitlist === true
        || req.body.isSubscribedToCoachesWaitlist === 'true';
    const isWaitlistRequest = isSubscribedToIosWaitlist || isSubscribedToCoachesWaitlist;
    const coachesWaitlistDetails = isSubscribedToCoachesWaitlist
        ? sanitizeCoachesWaitlistDetails(req.body.coachesWaitlistDetails)
        : {};
    const resolvedBrand = brandVariation || BrandVariations.THERR;
    const contextConfig = getHostContext(whiteLabelOrigin, resolvedBrand);

    // Best-effort: a failed notification must never fail the signup it reports on.
    const notifyCoachSignup = () => sendCoachesWaitlistAdminEmail({
        subject: `[${contextConfig.brandName}] New coach on the waitlist`,
        agencyDomainName: whiteLabelOrigin,
        brandVariation: resolvedBrand,
    }, {
        email,
        details: coachesWaitlistDetails,
    }).catch((error) => {
        logSpan({
            level: 'error',
            messageOrigin: 'API_SERVER',
            messages: ['Coach waitlist admin notification failed', error?.message],
            traceArgs: {
                'user.email': email,
            },
        });
    });

    return Store.subscribers.findSubscriber({ email })
        .then((findResults) => {
            if (findResults.length) {
                const existing = findResults[0];
                // An address already on the list that now asks for a waitlist is an upgrade, not
                // a duplicate. Rejecting it (which is still what a plain re-subscribe gets, so the
                // therr-landing signup form's behaviour is unchanged) would throw away the only
                // demand signal the waitlist exists to collect.
                const upgrade: Partial<ICreateSubscriberParams> = {};
                if (isSubscribedToIosWaitlist && !existing.isSubscribedToIosWaitlist) {
                    upgrade.isSubscribedToIosWaitlist = true;
                }
                const isNewCoach = isSubscribedToCoachesWaitlist && !existing.isSubscribedToCoachesWaitlist;
                if (isNewCoach) {
                    upgrade.isSubscribedToCoachesWaitlist = true;
                }
                if (isSubscribedToCoachesWaitlist) {
                    // A coach who submits again has probably changed an answer; keep the latest.
                    upgrade.coachesWaitlistDetails = JSON.stringify(coachesWaitlistDetails);
                }

                if (Object.keys(upgrade).length) {
                    return Store.subscribers.updateSubscriber(upgrade, { email })
                        .then(() => {
                            if (isNewCoach) {
                                notifyCoachSignup();
                            }
                            return res.status(200).send(toSignupResponse(email));
                        });
                }

                if (isWaitlistRequest) {
                    // Already on the waitlist. Idempotent success so a double submit reads as
                    // "you're on the list" rather than an error.
                    return res.status(200).send(toSignupResponse(email));
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
                // Only present on a coach signup, so every other insert keeps its exact column list.
                ...(isSubscribedToCoachesWaitlist ? {
                    isSubscribedToCoachesWaitlist: true,
                    coachesWaitlistDetails: JSON.stringify(coachesWaitlistDetails),
                } : {}),
            }).then(() => {
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
                if (isSubscribedToCoachesWaitlist) {
                    notifyCoachSignup();
                }

                return res.status(201).send(toSignupResponse(email));
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
