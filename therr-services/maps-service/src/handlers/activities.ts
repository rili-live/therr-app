import axios from 'axios';
import { parseHeaders } from 'therr-js-utilities/http';
import handleHttpError from '../utilities/handleHttpError';
import * as globalConfig from '../../../../global-config';

// READ
const getNearbyConnections = async (req, res) => {
    const {
        authorization,
        locale,
        userId,
        whiteLabelOrigin,
    } = parseHeaders(req.headers);
    const {
        distanceMeters,
    } = req.params;
    const distanceOrDefault = distanceMeters || '96560.6'; // ~60 miles converted to meters

    return axios({
        method: 'get',
        // eslint-disable-next-line max-len
        url: `${globalConfig[process.env.NODE_ENV].baseUsersServiceRoute}/users/connections/ranked?distanceMeters=${distanceOrDefault}`,
        headers: {
            authorization,
            'x-localecode': locale,
            'x-userid': userId,
            'x-therr-origin-host': whiteLabelOrigin,
        },
    }).then((response) => res.status(201).send(response.data))
        .catch((err) => handleHttpError({ err, res, message: 'SQL:ACTITIES_ROUTES:ERROR' }));
};

// WRITE
const createActivity = async (req, res) => {
    const {
        authorization,
        locale,
        userId,
        whiteLabelOrigin,
    } = parseHeaders(req.headers);
    const {
        distanceMeters,
        groupSize,
    } = req.body;
    const groupSizeOrDefault = groupSize || 3;
    const distanceOrDefault = distanceMeters || '96560.6'; // ~60 miles converted to meters

    return axios({
        method: 'get',
        // eslint-disable-next-line max-len
        url: `${globalConfig[process.env.NODE_ENV].baseUsersServiceRoute}/users/connections/ranked?groupSize=${groupSizeOrDefault}&distanceMeters=${distanceOrDefault}`,
        headers: {
            authorization,
            'x-localecode': locale,
            'x-userid': userId,
            'x-therr-origin-host': whiteLabelOrigin,
        },
    }).then((response) => res.status(201).send({
        members: response.data,
    })).catch((err) => handleHttpError({ err, res, message: 'SQL:ACTITIES_ROUTES:ERROR' }));
};

export {
    createActivity,
    getNearbyConnections,
};
