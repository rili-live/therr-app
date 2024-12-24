import logSpan from 'therr-js-utilities/log-or-update-span';
import { internalRestRequest, InternalConfigHeaders } from 'therr-js-utilities/internal-rest-request';
import * as globalConfig from '../../../../../global-config';

const getUserLocations = (userId: string, headers: InternalConfigHeaders) => internalRestRequest({
    headers,
}, {
    method: 'get',
    url: `${globalConfig[process.env.NODE_ENV].baseUsersServiceRoute}/users-locations/${userId}`,
}).catch((err) => {
    logSpan({
        level: 'error',
        messageOrigin: 'API_SERVER',
        messages: ['Error while fetching userLocations'],
        traceArgs: {
            'error.message': err?.message,
        },
    });
});

const createUserLocation = (userId: string, headers: InternalConfigHeaders, userLocation: {
    latitude: number;
    longitude: number;
    // latitudeRounded?: number;
    // longitudeRounded?: number;
    // visitCount?: number;
}) => internalRestRequest({
    headers,
}, {
    method: 'post',
    url: `${globalConfig[process.env.NODE_ENV].baseUsersServiceRoute}/users-locations/${userId}`,
    data: {
        latitude: userLocation.latitude,
        longitude: userLocation.longitude,
    },
}).catch((err) => {
    logSpan({
        level: 'error',
        messageOrigin: 'API_SERVER',
        messages: ['Error while saving userLocations'],
        traceArgs: {
            'error.message': err?.message,
        },
    });
});

const updateUserLocation = (userLocationId: string, headers: InternalConfigHeaders, data: {
    lastPushNotificationSent: Date,
}) => internalRestRequest({
    headers,
}, {
    method: 'put',
    url: `${globalConfig[process.env.NODE_ENV].baseUsersServiceRoute}/users-locations/${userLocationId}`,
    data: {
        lastPushNotificationSent: data.lastPushNotificationSent,
    },
}).catch((err) => {
    logSpan({
        level: 'error',
        messageOrigin: 'API_SERVER',
        messages: ['Error while updating userLocation'],
        traceArgs: {
            'error.message': err?.message,
        },
    });
});

export {
    getUserLocations,
    createUserLocation,
    updateUserLocation,
};
