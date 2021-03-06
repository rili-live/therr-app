import { v4 as uuidv4 } from 'uuid';
import handleHttpError from '../utilities/handleHttpError';
import restRequest from '../utilities/restRequest';

const handleServiceRequest = ({
    basePath,
    method,
}) => (req, res) => {
    const config: any = {
        headers: {
            authorization: req.headers.authorization || '',
            'x-requestid': uuidv4(),
            'x-localecode': req.headers['x-localecode'] || '',
            'x-userid': req.headers['x-userid'] || '',
        },
        method,
        url: `${basePath}${req.url}`,
    };

    if (method !== 'get') {
        config.data = req.body;
    }

    // TODO: RAUTO-27: Remove this
    if (req.headers.authorization) {
        config.headers.authorization = req.headers.authorization;
    }

    return restRequest(config)
        .then((response) => res.send(response.data))
        .catch((error) => {
            if (error && error.response && error.response.data) {
                return handleHttpError({
                    err: error,
                    res,
                    message: error.response.data.message,
                    statusCode: error.response.data.statusCode,
                });
            }

            return res.status(500);
        });
};

export default handleServiceRequest;
