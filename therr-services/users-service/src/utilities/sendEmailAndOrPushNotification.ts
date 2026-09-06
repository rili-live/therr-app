import { internalRestRequest, InternalConfigHeaders } from 'therr-js-utilities/internal-rest-request';
import { PushNotifications } from 'therr-js-utilities/constants';
import logSpan from 'therr-js-utilities/log-or-update-span';
import sendPendingInviteEmail from '../api/email/for-social/retention/sendPendingInviteEmail';
import sendNewGroupMembersEmail from '../api/email/for-social/sendNewGroupMembersEmail';
import sendNewGroupInviteEmail from '../api/email/for-social/sendNewGroupInviteEmail';
import * as globalConfig from '../../../../global-config';
import Store from '../store';
import { IFindUserArgs } from '../store/UsersStore';
import translate from './translator';

// Brand-scoped push routing (Phase 2 of the multi-app data isolation rollout, now complete).
//
// A device token identifies one *app install*, not a user and not a Firebase project. Therr
// and Friends with Habits ship from a single Firebase project, so FCM accepts either app's
// token from either brand's service account — which means a mis-addressed push does not
// error, it silently renders in the wrong app. That is what makes this the one lookup that
// has to be exactly right: `main.userDeviceTokens` keyed on (userId, brandVariation) is the
// only thing standing between a Habits streak reminder and the user's Therr install.
//
// This used to fall back to the legacy `users.deviceMobileFirebaseToken` column when the
// brand had no row. That column is shared across every branded app on the device and is
// overwritten by whichever registered last, so the fallback did precisely the thing this
// function exists to prevent: a Habits send for a user with no `habits` row resolved their
// *Therr* install and delivered there, under Therr's name. It was invisible — the caller
// had a valid-looking token, nothing logged, and FCM reported success.
//
// The fallback is gone. `20260904000001_main.userDeviceTokens.backfill.js` migrated the
// population it legitimately served (single-brand accounts that had never re-registered)
// into real rows, and TherrMobile now writes the brand-scoped row once per app session
// unconditionally. What is left is the ambiguous multi-brand case, where the right answer
// is no token at all: the send is skipped as 'no-device-token', which is visible and
// self-healing on the user's next app open, rather than delivered to the wrong product.
//
// Exported for unit testing.
export const resolveDeviceTokenForBrand = async (
    brand: string,
    toUserId: string,
): Promise<string | null> => {
    if (!brand || !toUserId) {
        // Always a caller bug — every producer either pins a brand or reads one off the
        // request. Logged at error level because it is now a dropped notification rather
        // than a silently mis-routed one, and a dropped one is what someone will come
        // looking for.
        logSpan({
            level: 'error',
            messageOrigin: 'API_SERVER',
            messages: ['Push send with no brandVariation or userId — cannot resolve a device token, notification dropped'],
            traceArgs: {
                'user.id': toUserId,
                'pushNotification.brandVariation': String(brand ?? ''),
                source: 'users-service',
            },
        });
        return null;
    }
    try {
        const rows = await Store.userDeviceTokens.getTokensForUser(brand, toUserId);
        return rows[0]?.token || null;
    } catch (err: any) {
        // Distinguished from "this user has no device" by the caller only through this
        // log: both return null. Without it a read-pool outage looks exactly like a
        // population of users who never enabled push.
        logSpan({
            level: 'error',
            messageOrigin: 'API_SERVER',
            messages: ['Failed to read userDeviceTokens — treating as no device token'],
            traceArgs: {
                'error.message': err?.message,
                'user.id': toUserId,
                'pushNotification.brandVariation': String(brand),
                source: 'users-service',
            },
        });
        return null;
    }
};

// Batch variant of resolveDeviceTokenForBrand for fan-out endpoints (group-message notify, etc.).
// Returns a new array with deviceMobileFirebaseToken replaced by the brand-scoped token, or null
// where this brand has no registration. Same no-fallback contract as the single-user resolver —
// see the note above for why an un-addressable recipient must resolve to null rather than to the
// shared legacy column. Callers fan out to a push service that cannot send without a token, so
// they are expected to drop the null entries rather than pass them on.
export const resolveDeviceTokensForBrand = async <U extends { id: string; deviceMobileFirebaseToken?: string | null }>(
    brand: string,
    users: U[],
): Promise<U[]> => {
    if (users.length === 0) return users;
    if (!brand) {
        logSpan({
            level: 'error',
            messageOrigin: 'API_SERVER',
            messages: ['Push fan-out with no brandVariation — cannot resolve device tokens, batch dropped'],
            traceArgs: {
                'pushNotification.recipientCount': users.length,
                source: 'users-service',
            },
        });
        return users.map((u) => ({ ...u, deviceMobileFirebaseToken: null }));
    }
    const ids = users.map((u) => u.id).filter(Boolean);
    if (!ids.length) return users;
    let rows: { userId: string; token: string }[] = [];
    try {
        rows = await Store.userDeviceTokens.getTokensForUsers(brand, ids);
    } catch (err: any) {
        // A read failure drops the batch rather than falling back. Delivering a group
        // message to everyone's wrong app is worse than delivering it to no one, and the
        // sender is not waiting on the push.
        logSpan({
            level: 'error',
            messageOrigin: 'API_SERVER',
            messages: ['Failed to read userDeviceTokens for fan-out — treating as no device tokens'],
            traceArgs: {
                'error.message': err?.message,
                'pushNotification.brandVariation': String(brand),
                'pushNotification.recipientCount': users.length,
                source: 'users-service',
            },
        });
    }
    const tokenByUserId = new Map<string, string>();
    rows.forEach((row) => {
        if (!tokenByUserId.has(row.userId)) tokenByUserId.set(row.userId, row.token);
    });
    return users.map((u) => ({
        ...u,
        deviceMobileFirebaseToken: tokenByUserId.get(u.id) || null,
    }));
};

export interface ISendPushNotification extends PushNotifications.INotificationData {
    authorization: any;
    fromUserNames?: string[];
    locale: any;
    toUserId: any;
    type: PushNotifications.Types;
    retentionEmailType?: PushNotifications.Types;
    whiteLabelOrigin: string;
    brandVariation: string;
    // HABITS payload fields. Forwarded as-is to push-notifications-service so
    // streak / pact / partner copy can render rich, name-anchored content.
    streakCount?: number;
    previousRecordDays?: number;
    partnerName?: string;
    pactId?: string;
    pactName?: string;
    habitId?: string;
    habitName?: string;
    // The habit goal a one-press "Check In" action would complete. Distinct
    // from `habitName` (copy) and `habitId`: this is the id the device POSTs to
    // /habits/checkins straight from the notification, so it must only be set
    // when the notification unambiguously names one habit.
    habitGoalId?: string;
    // Set by the digest's per-user roll-up. `habitCount > 1` means one
    // notification stands in for several habits, which selects the plural copy
    // and suppresses the check-in action.
    habitCount?: number;
    habitNames?: string[];
    daysRemaining?: number;
    // The length of the cycle a `pactEnded` notification is about. This list is
    // an allow-list, not a passthrough — a field the producer sets but that is
    // missing here is dropped silently, and the copy renders a zero.
    durationDays?: number;
    // Streak freezes ("build in the miss"). `freezesRemaining` is what is left
    // *after* the spend, so the copy can promise a net that is still there.
    freezesRemaining?: number;
    freezeDaysUsed?: number;
    // HABITS lifecycle payload (docs/HABIT_LIFECYCLE_MESSAGING.md). Age of the
    // habit in days, trailing-window consistency as a whole percent, and the
    // user's best-ever streak — the comeback copy leans on that last one to
    // reference a past success rather than a present failure.
    dayCount?: number;
    consistencyPercent?: number;
    bestStreakCount?: number;
    // Leaderboards: the user's new weekly rank, for rank-milestone copy
    rank?: number;
}

interface ISendPushNotificationAndOrEmailConfig {
    shouldSendPushNotification?: boolean;
    shouldSendEmail?: boolean;
    /**
     * Re-throw after logging instead of resolving.
     *
     * Defaults to false, which is right for every inline caller: they run inside
     * a user-facing request that must succeed whether or not a notification got
     * out, so a dead device token can never fail someone's check-in.
     *
     * The notification queue worker is the exception. It records a per-row
     * outcome and retries, and a swallowed error there means every row is marked
     * 'sent' regardless — which would make `markFailed`, `requeueFailed` and
     * `MAX_ATTEMPTS` unreachable for real send failures and quietly reduce the
     * queue's retry story to "crash recovery only".
     */
    shouldThrowOnError?: boolean;
}

export default (
    findUser: (args: IFindUserArgs, returning: any[]) => Promise<{
        deviceMobileFirebaseToken: string;
        email: string;
        isUnclaimed: boolean;
        settingsEmailInvites: boolean;
    }[]>,
    headers: InternalConfigHeaders,
    {
        area,
        authorization,
        groupName,
        groupId,
        fromUser,
        fromUserNames,
        locale,
        postType,
        toUserId,
        thought,
        type,
        retentionEmailType,
        whiteLabelOrigin,
        brandVariation,
        streakCount,
        previousRecordDays,
        partnerName,
        pactId,
        pactName,
        habitId,
        habitName,
        habitGoalId,
        habitCount,
        habitNames,
        daysRemaining,
        durationDays,
        freezesRemaining,
        freezeDaysUsed,
        dayCount,
        consistencyPercent,
        bestStreakCount,
        rank,
    }: ISendPushNotification,
    config: ISendPushNotificationAndOrEmailConfig = {
        shouldSendPushNotification: true,
        shouldSendEmail: true,
    },
): Promise<any> => findUser({ id: toUserId }, ['deviceMobileFirebaseToken', 'email', 'isUnclaimed', 'settingsEmailInvites', 'settingsLocale'])
    .then(async (userResults) => {
        const destinationUser = userResults?.[0];
        if (!destinationUser || destinationUser.isUnclaimed) {
            // Don't send notification/email
            return Promise.resolve({});
        }
        const resolvedDeviceToken = await resolveDeviceTokenForBrand(brandVariation, toUserId);

        const emailLocale = (destinationUser as any).settingsLocale || locale || 'en-us';
        let sendEmail: () => Promise<any> = () => Promise.resolve();

        // Only send email if configured
        if (config.shouldSendEmail) {
            if (retentionEmailType === PushNotifications.Types.newConnectionRequest) {
                if (fromUser?.userName) {
                    sendEmail = () => sendPendingInviteEmail({
                        subject: translate(emailLocale, 'emails.sendEmailAndOrPush.connectionRequestSubject', { userName: fromUser.userName }),
                        locale: emailLocale,
                        toAddresses: [destinationUser.email],
                        agencyDomainName: whiteLabelOrigin,
                        brandVariation,
                        recipientIdentifiers: {
                            id: toUserId,
                            accountEmail: destinationUser.email,
                            settingsEmailInvites: destinationUser.settingsEmailInvites,
                        },
                    }, {
                        fromName: fromUser.userName,
                    });
                } else {
                    logSpan({
                        level: 'warn',
                        messageOrigin: 'API_SERVER',
                        messages: ['"fromUser.userName" is not defined. Skipping email.'],
                        traceArgs: {
                            issue: 'error with sendPendingInviteEmail',
                        },
                    });
                }
            } else if (retentionEmailType === PushNotifications.Types.newGroupMembers
                    && groupName && groupId) {
                sendEmail = () => sendNewGroupMembersEmail({
                    subject: translate(emailLocale, 'emails.sendEmailAndOrPush.newGroupMembersSubject'),
                    locale: emailLocale,
                    toAddresses: [destinationUser.email],
                    agencyDomainName: whiteLabelOrigin,
                    brandVariation,
                    recipientIdentifiers: {
                        id: toUserId,
                        accountEmail: destinationUser.email,
                        settingsEmailInvites: destinationUser.settingsEmailInvites,
                    },
                }, {
                    groupId,
                    groupName,
                    membersList: fromUserNames,
                });
            } else if (retentionEmailType === PushNotifications.Types.newGroupInvite
                    && groupName && groupId) {
                sendEmail = () => sendNewGroupInviteEmail({
                    subject: translate(emailLocale, 'emails.sendEmailAndOrPush.newGroupInviteSubject', { userName: fromUser?.userName || 'A user', groupName }),
                    locale: emailLocale,
                    toAddresses: [destinationUser.email],
                    agencyDomainName: whiteLabelOrigin,
                    brandVariation,
                    recipientIdentifiers: {
                        id: toUserId,
                        accountEmail: destinationUser.email,
                        settingsEmailInvites: destinationUser.settingsEmailInvites,
                    },
                }, {
                    groupId,
                    groupName,
                    fromUserName: fromUser?.userName || 'A user',
                });
            }
        }

        sendEmail().catch((err) => {
            logSpan({
                level: 'error',
                messageOrigin: 'API_SERVER',
                messages: ['Error sending retention email', err?.message],
                traceArgs: {
                    issue: 'error with sendEmailAndOrPushNotification email',
                },
            });
        });

        const pushNotificationPromise: Promise<any> = config.shouldSendPushNotification
            ? internalRestRequest({
                headers,
            }, {
                method: 'post',
                url: `${globalConfig[process.env.NODE_ENV].basePushNotificationsServiceRoute}/notifications/send`,
                headers: {
                    authorization,
                    'x-localecode': locale,
                    'x-userid': fromUser?.id || '',
                    'x-therr-origin-host': whiteLabelOrigin,
                },
                data: {
                    area,
                    fromUserName: fromUser?.userName,
                    fromUserId: fromUser?.id,
                    groupId,
                    groupName,
                    groupMembersList: fromUserNames,
                    postType,
                    toUserDeviceToken: resolvedDeviceToken,
                    type,
                    thought,
                    streakCount,
                    previousRecordDays,
                    partnerName,
                    pactId,
                    pactName,
                    habitId,
                    habitName,
                    habitGoalId,
                    habitCount,
                    habitNames,
                    daysRemaining,
                    durationDays,
                    freezesRemaining,
                    freezeDaysUsed,
                    dayCount,
                    consistencyPercent,
                    bestStreakCount,
                    rank,
                    // achievementsCount,
                    // likeCount,
                    // notificationsCount,
                    // totalAreasActivated,
                    // viewCount,
                },
            })
            : Promise.resolve();

        return pushNotificationPromise;
    }).catch((error) => {
        logSpan({
            level: 'error',
            messageOrigin: 'API_SERVER',
            messages: [error?.message],
            traceArgs: {
                issue: 'error with sendEmailAndOrPushNotification',
            },
        });

        // Opt-in only. See shouldThrowOnError above: swallowing is the correct
        // default for request-path callers and the wrong one for the queue.
        if (config.shouldThrowOnError) {
            throw error;
        }
    });
