import axios from 'axios';
import logSpan from 'therr-js-utilities/log-or-update-span';
import * as globalConfig from '../../../../../global-config';

const getUserLocations = (userId: string, headers) => axios({
    method: 'get',
    url: `${globalConfig[process.env.NODE_ENV].baseUsersServiceRoute}/users-locations/${userId}`,
    headers: {
        authorization: headers.authorization,
        'x-localecode': headers.locale,
        'x-userid': headers.userId,
        'x-therr-origin-host': headers.whiteLabelOrigin,
    },
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

const createUserLocation = (userId: string, headers, userLocation: {
    latitude: number;
    longitude: number;
    // latitudeRounded?: number;
    // longitudeRounded?: number;
    // visitCount?: number;
}) => axios({
    method: 'post',
    url: `${globalConfig[process.env.NODE_ENV].baseUsersServiceRoute}/users-locations/${userId}`,
    headers: {
        authorization: headers.authorization,
        'x-localecode': headers.locale,
        'x-userid': headers.userId,
        'x-therr-origin-host': headers.whiteLabelOrigin,
    },
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

const updateUserLocation = (userLocationId: string, headers, data: {
    lastPushNotificationSent: Date,
}) => axios({
    method: 'put',
    url: `${globalConfig[process.env.NODE_ENV].baseUsersServiceRoute}/users-locations/${userLocationId}`,
    headers: {
        authorization: headers.authorization,
        'x-localecode': headers.locale,
        'x-userid': headers.userId,
        'x-therr-origin-host': headers.whiteLabelOrigin,
    },
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
