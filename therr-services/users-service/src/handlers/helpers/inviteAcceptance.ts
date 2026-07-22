import {
    CurrentSocialValuations, MetricNames, Notifications, PushNotifications, UserConnectionTypes,
} from 'therr-js-utilities/constants';
import { parseHeaders } from 'therr-js-utilities/http';
import logSpan from 'therr-js-utilities/log-or-update-span';
import Store from '../../store';
import sendEmailAndOrPushNotification from '../../utilities/sendEmailAndOrPushNotification';
import recordFunnelMetric from '../../utilities/recordFunnelMetric';

export interface IFirstLoginUser {
    id: string;
    email?: string;
    phoneNumber?: string;
    firstName?: string;
    lastName?: string;
}

export interface IAcceptInvitesResult {
    acceptedInviteIds: string[];
    connectedUserIds: string[];
}

/**
 * Idempotently guarantees a COMPLETE (accepted, unbroken) connection between two
 * users, regardless of which direction an existing row was created in.
 *
 * Invite acceptance and pact acceptance are both explicit "yes" signals from the
 * second user, so the resulting connection skips the PENDING request state — the
 * request/accept ceremony already happened out-of-band via the invite itself.
 *
 * Returns the connection row, or null when the pair is invalid (missing/self).
 */
export const ensureCompletedUserConnection = async (
    requestingUserId: string,
    acceptingUserId: string,
): Promise<any | null> => {
    if (!requestingUserId || !acceptingUserId || requestingUserId === acceptingUserId) {
        return null;
    }

    const existing = await Store.userConnections.getUserConnections({
        requestingUserId,
        acceptingUserId,
    }, true);

    if (existing.length) {
        const connection = existing[0];
        if (connection.requestStatus === UserConnectionTypes.COMPLETE && !connection.isConnectionBroken) {
            return connection;
        }
        // Existing PENDING/MIGHT_KNOW/broken row — promote it in place using the
        // row's own column order so the WHERE clause matches.
        const updated = await Store.userConnections.updateUserConnection({
            requestingUserId: connection.requestingUserId,
            acceptingUserId: connection.acceptingUserId,
        }, {
            requestStatus: UserConnectionTypes.COMPLETE,
            isConnectionBroken: false,
        });
        return updated?.[0] || connection;
    }

    const created = await Store.userConnections.createUserConnection({
        requestingUserId,
        acceptingUserId,
        requestStatus: UserConnectionTypes.COMPLETE,
    });
    return created?.[0] || null;
};

/**
 * First-login invite redemption. Called (fire-and-forget) from the login
 * handler when a user's loginCount indicates this is their first session.
 *
 * For every pending invite that matches the new user's e-mail or phone number:
 *   1. marks the invite accepted,
 *   2. rewards each distinct inviter with coins,
 *   3. ensures a COMPLETE userConnection between inviter and invitee — this is
 *      the contract the viral loop depends on: the person you invited shows up
 *      in your connections the moment they first sign in,
 *   4. notifies the inviter (in-app notification + push) that their friend joined.
 *
 * All failures are logged and isolated per-invite so one bad row can't block
 * the rest, and the caller never awaits this on the login critical path.
 */
export const acceptInvitesOnFirstLogin = async (
    headers: any,
    user: IFirstLoginUser,
): Promise<IAcceptInvitesResult> => {
    const {
        authorization,
        locale,
        whiteLabelOrigin,
        brandVariation,
    } = parseHeaders(headers);

    const result: IAcceptInvitesResult = {
        acceptedInviteIds: [],
        connectedUserIds: [],
    };

    if (!user?.id || (!user.email && !user.phoneNumber)) {
        return result;
    }

    const [emailInvites, phoneInvites] = await Promise.all([
        user.email
            ? Store.invites.getInvitesForEmail({ email: user.email, isAccepted: false }).catch(() => [])
            : Promise.resolve([]),
        user.phoneNumber
            ? Store.invites.getInvitesForPhoneNumber({ phoneNumber: user.phoneNumber, isAccepted: false }).catch(() => [])
            : Promise.resolve([]),
    ]);

    const invitesById = new Map<string, any>();
    [...emailInvites, ...phoneInvites].forEach((invite) => {
        if (invite?.id && !invitesById.has(invite.id)) {
            invitesById.set(invite.id, invite);
        }
    });

    if (!invitesById.size) {
        return result;
    }

    // 1. Mark all matching invites accepted.
    await Promise.all(Array.from(invitesById.values()).map((invite) => Store.invites
        .updateInvite({ id: invite.id }, { isAccepted: true })
        .then((rows) => {
            if (rows?.length) {
                result.acceptedInviteIds.push(invite.id);
            }
        })
        .catch((err) => {
            logSpan({
                level: 'error',
                messageOrigin: 'API_SERVER',
                messages: [err?.message, 'Failed to mark invite accepted on first login'],
                traceArgs: { 'invite.id': invite.id, 'user.id': user.id },
            });
        })));

    const inviterIds = Array.from(new Set(
        Array.from(invitesById.values())
            .map((invite) => invite.requestingUserId)
            .filter((inviterId) => inviterId && inviterId !== user.id),
    ));

    // 2-4. Reward, connect, and notify each distinct inviter.
    await Promise.all(inviterIds.map(async (inviterId) => {
        try {
            await Store.users.updateUser({
                settingsTherrCoinTotal: CurrentSocialValuations.invite,
            }, {
                id: inviterId,
            });
        } catch (err: any) {
            logSpan({
                level: 'error',
                messageOrigin: 'API_SERVER',
                messages: [err?.message, 'Failed to reward inviter coins on first login'],
                traceArgs: { 'inviter.id': inviterId, 'user.id': user.id },
            });
        }

        let connection;
        try {
            connection = await ensureCompletedUserConnection(inviterId, user.id);
            if (connection) {
                result.connectedUserIds.push(inviterId);
            }
        } catch (err: any) {
            logSpan({
                level: 'error',
                messageOrigin: 'API_SERVER',
                messages: [err?.message, 'Failed to create inviter connection on first login'],
                traceArgs: { 'inviter.id': inviterId, 'user.id': user.id },
            });
            return;
        }

        // In-app notification for the inviter (brand-scoped store).
        Store.notifications.createNotification(brandVariation, {
            userId: inviterId,
            type: Notifications.Types.CONNECTION_REQUEST_ACCEPTED,
            associationId: connection?.id,
            isUnread: true,
            messageLocaleKey: Notifications.MessageKeys.CONNECTION_REQUEST_ACCEPTED,
            messageParams: {
                userId: user.id,
                firstName: user.firstName || '',
                lastName: user.lastName || '',
            },
        }).catch((err) => {
            logSpan({
                level: 'error',
                messageOrigin: 'API_SERVER',
                messages: [err?.message, 'Failed to create inviter joined notification'],
                traceArgs: { 'inviter.id': inviterId, 'user.id': user.id },
            });
        });

        // Push notification — "<name> accepted your connection request". This is
        // the inviter's re-engagement moment; deliverability matters for the
        // viral loop but must never fail the flow.
        sendEmailAndOrPushNotification(Store.users.findUser, headers, {
            authorization,
            fromUser: {
                id: user.id,
                userName: `${user.firstName || ''} ${user.lastName || ''}`.trim(),
            },
            locale,
            toUserId: inviterId,
            type: PushNotifications.Types.connectionRequestAccepted,
            whiteLabelOrigin,
            brandVariation,
        }).catch((err) => {
            logSpan({
                level: 'error',
                messageOrigin: 'API_SERVER',
                messages: [err?.message, 'Failed to send inviter joined push notification'],
                traceArgs: { 'inviter.id': inviterId, 'user.id': user.id },
            });
        });
    }));

    if (result.connectedUserIds.length) {
        recordFunnelMetric(MetricNames.FUNNEL_INVITE_ACCEPTED, user.id, {
            brandVariation: brandVariation || '',
        }, String(result.connectedUserIds.length));
    }

    return result;
};

export default acceptInvitesOnFirstLogin;
