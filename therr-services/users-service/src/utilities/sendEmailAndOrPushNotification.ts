import axios from 'axios';
import { PushNotifications } from 'therr-js-utilities/constants';
import logSpan from 'therr-js-utilities/log-or-update-span';
import sendPendingInviteEmail from '../api/email/for-social/retention/sendPendingInviteEmail';
import sendNewGroupMembersEmail from '../api/email/for-social/sendNewGroupMembersEmail';
import sendNewGroupInviteEmail from '../api/email/for-social/sendNewGroupInviteEmail';
import * as globalConfig from '../../../../global-config';
import { IFindUserArgs } from '../store/UsersStore';

interface ISendPushNotification extends PushNotifications.INotificationData {
    authorization: any;
    fromUserNames?: string[];
    locale: any;
    toUserId: any;
    type: PushNotifications.Types;
    retentionEmailType?: PushNotifications.Types;
    whiteLabelOrigin: string;
    brandVariation: string;
}

interface ISendPushNotificationAndOrEmailConfig {
    shouldSendPushNotification?: boolean;
    shouldSendEmail?: boolean;
}

export default (
    findUser: (args: IFindUserArgs, returning: any[]) => Promise<{
        deviceMobileFirebaseToken: string;
        email: string;
        isUnclaimed: boolean;
        settingsEmailInvites: boolean;
    }[]>,
    {
        authorization,
        groupName,
        groupId,
        fromUser,
        fromUserNames,
        locale,
        toUserId,
        type,
        retentionEmailType,
        whiteLabelOrigin,
        brandVariation,
    }: ISendPushNotification,
    config: ISendPushNotificationAndOrEmailConfig = {
        shouldSendPushNotification: true,
        shouldSendEmail: true,
    },
): Promise<any> => findUser({ id: toUserId }, ['deviceMobileFirebaseToken', 'email', 'isUnclaimed', 'settingsEmailInvites'])
    .then((userResults) => {
        const destinationUser = userResults?.[0];
        if (!destinationUser || destinationUser.isUnclaimed) {
            // Don't send notification/email
            return Promise.resolve({});
        }

        let sendEmail: () => Promise<any> = () => Promise.resolve();

        // Only send email if configured
        if (config.shouldSendEmail) {
            if (retentionEmailType === PushNotifications.Types.newConnectionRequest) {
                if (fromUser?.userName) {
                    sendEmail = () => sendPendingInviteEmail({
                        subject: `[New Connection Request] ${fromUser.userName} sent you a request`,
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
                    subject: 'New Member(s) Joined Your Group!',
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
                    subject: `${fromUser?.userName} invited you to join the Group, ${groupName}`,
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

        sendEmail();

        const pushNotificationPromise: Promise<any> = config.shouldSendPushNotification
            ? axios({
                method: 'post',
                url: `${globalConfig[process.env.NODE_ENV].basePushNotificationsServiceRoute}/notifications/send`,
                headers: {
                    authorization,
                    'x-localecode': locale,
                    'x-userid': fromUser?.id || '',
                    'x-therr-origin-host': whiteLabelOrigin,
                },
                data: {
                    fromUserName: fromUser?.userName,
                    toUserDeviceToken: destinationUser.deviceMobileFirebaseToken,
                    type,
                    fromUserId: fromUser?.id,
                    groupId,
                    groupName,
                    groupMembersList: fromUserNames,
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
    });
