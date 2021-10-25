import axios from 'axios';
import * as globalConfig from '../../../../global-config';

export default (findUser, {
    authorization,
    fromUserName,
    fromUserId,
    locale,
    toUserId,
}) => {
    findUser({ id: toUserId }, ['deviceMobileFirebaseToken']).then(([destinationUser]) => axios({
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
        },
    })).catch((error) => {
        console.log(error);
    });
};
