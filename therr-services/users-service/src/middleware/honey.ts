import os from 'os';
import beeline from '../beeline';

export default (req, res, next) => {
    const serializedBody = {
        ...req.body,
    };
    if (req.body && req.body.idToken) {
        serializedBody.idToken = 'XXXXX';
    }
    if (req.body && req.body.password) {
        serializedBody.password = 'XXXXX';
    }
    const serializedQuery = {
        ...req.query,
        idToken: 'XXXXX',
    };
    if (req.query && req.query.idToken) {
        serializedQuery.idToken = 'XXXXX';
    }
    beeline.addContext({
        'request.app': req.app,
        'request.ip': req.ip,
        'request.body': serializedBody,
        'request.query': serializedQuery,
        'request.osHostname': os.hostname(),
    });

    return next();
};
