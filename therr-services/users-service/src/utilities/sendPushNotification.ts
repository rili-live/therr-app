import axios from 'axios';
import { PushNotifications } from 'therr-js-utilities/constants';
import sendPendingInviteEmail from '../api/email/retention/sendPendingInviteEmail';
import * as globalConfig from '../../../../global-config';

interface ISendPushNotification {
    authorization: any;
    fromUserName: any;
    fromUserId: any;
    locale: any;
    toUserId: any;
    type: any;
    retentionEmailType?: PushNotifications.Types;
}

export default (findUser, {
    authorization,
    fromUserName,
    fromUserId,
    locale,
    toUserId,
    type,
    retentionEmailType,
}: ISendPushNotification) => findUser({ id: toUserId }, ['deviceMobileFirebaseToken', 'email']).then(([destinationUser]) => {
    if (retentionEmailType === PushNotifications.Types.newConnectionRequest) {
        sendPendingInviteEmail({
            subject: `[New Connection Request] ${fromUserName} sent you a request on Therr App`,
            toAddresses: [destinationUser.email],
        }, {
            fromName: fromUserName,
        });
    }

    return axios({
        method: 'post',
        url: `${globalConfig[process.env.NODE_ENV].basePushNotificationsServiceRoute}/notifications/send`,
        headers: {
            authorization,
            'x-localecode': locale,
            'x-userid': fromUserId,
        },
        data: {
            fromUserName,
            toUserDeviceToken: destinationUser.deviceMobileFirebaseToken,
            type,
        },
    });
}).catch((error) => {
    console.log(error);
});
