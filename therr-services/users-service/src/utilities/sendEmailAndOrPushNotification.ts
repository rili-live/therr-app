import axios from 'axios';
import { PushNotifications } from 'therr-js-utilities/constants';
import logSpan from 'therr-js-utilities/log-or-update-span';
import sendPendingInviteEmail from '../api/email/retention/sendPendingInviteEmail';
import sendNewGroupMembersEmail from '../api/email/sendNewGroupMembersEmail';
import * as globalConfig from '../../../../global-config';
import { IFindUserArgs } from '../store/UsersStore';

interface ISendPushNotification {
    authorization: any;
    fromUserName?: any;
    fromUserId: any;
    fromUserNames?: string[];
    groupName?: string;
    locale: any;
    toUserId: any;
    type: any;
    retentionEmailType?: PushNotifications.Types;
    whiteLabelOrigin: string;
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
    }[]>,
    {
        authorization,
        groupName,
        fromUserName,
        fromUserId,
        fromUserNames,
        locale,
        toUserId,
        type,
        retentionEmailType,
        whiteLabelOrigin,
    }: ISendPushNotification,
    config: ISendPushNotificationAndOrEmailConfig = {
        shouldSendPushNotification: true,
        shouldSendEmail: true,
    },
): Promise<any> => findUser({ id: toUserId }, ['deviceMobileFirebaseToken', 'email', 'isUnclaimed'])
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
                if (fromUserName) {
                    sendEmail = () => sendPendingInviteEmail({
                        subject: `[New Connection Request] ${fromUserName} sent you a request on Therr App`,
                        toAddresses: [destinationUser.email],
                        agencyDomainName: whiteLabelOrigin,
                    }, {
                        fromName: fromUserName,
                    });
                } else {
                    logSpan({
                        level: 'warn',
                        messageOrigin: 'API_SERVER',
                        messages: ['"fromUserName" is not defined. Skipping email.'],
                        traceArgs: {
                            issue: 'error with sendPendingInviteEmail',
                        },
                    });
                }
            } else if (retentionEmailType === PushNotifications.Types.newGroupMembers
                    && groupName) {
                sendEmail = () => sendNewGroupMembersEmail({
                    subject: 'New Member(s) Joined Your Group!',
                    toAddresses: [destinationUser.email],
                    agencyDomainName: whiteLabelOrigin,
                }, {
                    groupName,
                    membersList: fromUserNames,
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
                    'x-userid': fromUserId,
                    'x-therr-origin-host': whiteLabelOrigin,
                },
                data: {
                    fromUserName,
                    toUserDeviceToken: destinationUser.deviceMobileFirebaseToken,
                    type,
                    groupName,
                    groupMembersList: fromUserNames,
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
