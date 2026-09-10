import logSpan from 'therr-js-utilities/log-or-update-span';
import { internalRestRequest, InternalConfigHeaders } from 'therr-js-utilities/internal-rest-request';
import * as globalConfig from '../../../../../global-config';

const getCurrentUser = (headers: InternalConfigHeaders) => internalRestRequest({
    headers,
}, {
    method: 'get',
    url: `${globalConfig[process.env.NODE_ENV].baseUsersServiceRoute}/users/me`,
}).catch((err) => {
    logSpan({
        level: 'error',
        messageOrigin: 'API_SERVER',
        messages: ['Error while fetching user details'],
        traceArgs: {
            'error.message': err?.message,
        },
    });
});

// Calls users-service to clear an FCM token that FCM has reported as no longer
// valid. Only clears if the stored token still matches, so a freshly rotated
// token isn't clobbered. Swallows its own errors — token cleanup must never
// fail the originating push flow.
const clearInvalidDeviceToken = (
    headers: InternalConfigHeaders | undefined,
    userId: string | undefined,
    deviceToken: string,
) => {
    if (!userId || !deviceToken) {
        return Promise.resolve();
    }
    return internalRestRequest({
        headers: headers || ({} as InternalConfigHeaders),
    }, {
        method: 'post',
        url: `${globalConfig[process.env.NODE_ENV].baseUsersServiceRoute}/users/internal/clear-device-token`,
        data: { userId, deviceToken },
    }).catch((err) => {
        logSpan({
            level: 'error',
            messageOrigin: 'API_SERVER',
            messages: ['Failed to clear invalid FCM device token'],
            traceArgs: {
                'user.id': userId,
                'error.message': err?.message,
            },
        });
    });
};

export {
    getCurrentUser,
    clearInvalidDeviceToken,
};
