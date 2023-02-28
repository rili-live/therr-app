import { v4 as uuidv4 } from 'uuid';
import handleHttpError from '../utilities/handleHttpError';
import restRequest from '../utilities/restRequest';
import isBlacklisted from '../utilities/isBlacklisted';

interface IHandleServiceRequestArgs {
    basePath: string;
    method: string;
    overrideUrl?: string;
}

const handleServiceRequest = ({
    basePath,
    method,
    overrideUrl,
}: IHandleServiceRequestArgs, updateCache?: (result: any) => void) => (req, res) => {
    const config: any = {
        headers: {
            authorization: req.headers.authorization || '',
            'x-requestid': uuidv4(),
            'x-localecode': req.headers['x-localecode'] || '',
            'x-platform': req.headers['x-platform'] || '',
            'x-userid': req.headers['x-userid'] || req['x-userid'] || '',
            'x-username': req.headers['x-username'] || req['x-username'] || '',
            'x-user-device-token': req.headers['x-user-device-token'] || '',
        },
        method,
        url: `${basePath}${overrideUrl || req.url}`,
    };

    if (method !== 'get') {
        config.data = req.body;
    }

    // TODO: RAUTO-27: Remove this
    if (req.headers.authorization) {
        config.headers.authorization = req.headers.authorization;
    }

    if (isBlacklisted(req.ip)) {
        return handleHttpError({
            err: new Error('IP address is blacklisted'),
            res,
            message: 'Invalid request. Please try again later.',
            statusCode: 400,
        });
    }

    return restRequest(config)
        .then((response) => {
            if (updateCache) {
                updateCache(response.data);
            }
            return res.send(response.data);
        })
        .catch((error) => {
            if (error?.response?.status === 301) {
                return res.status(301).redirect(error.response.data.redirectUrl);
            }

            if (!error.response) {
                console.log(error);
            }

            return handleHttpError({
                err: error,
                res,
                message: error?.response?.data?.message || error,
                statusCode: error?.response?.data?.statusCode || 500,
                errorCode: error?.response?.data?.errorCode || 500,
            });
        });
};

export default handleServiceRequest;
