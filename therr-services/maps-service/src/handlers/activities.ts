import axios from 'axios';
import { parseHeaders } from 'therr-js-utilities/http';
import handleHttpError from '../utilities/handleHttpError';
import * as globalConfig from '../../../../global-config';

// CREATE
const createActivity = async (req, res) => {
    const {
        authorization,
        locale,
        userId,
        whiteLabelOrigin,
    } = parseHeaders(req.headers);

    return axios({
        method: 'get',
        url: `${globalConfig[process.env.NODE_ENV].baseUsersServiceRoute}/users/connections/ranked`,
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
};
