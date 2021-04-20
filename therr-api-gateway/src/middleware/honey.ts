import os from 'os';
import beeline from '../beeline';

export default (req, res, next) => {
    beeline.addContext({
        'request.app': req.app,
        'request.ip': req.ip,
        'request.body': req.body,
        'request.osHostname': os.hostname(),
    });

    return next();
};
