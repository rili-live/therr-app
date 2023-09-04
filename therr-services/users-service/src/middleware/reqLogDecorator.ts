import os from 'os';
import opentelemetry from '@opentelemetry/api';

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
    const activeSpan = opentelemetry.trace.getActiveSpan();
    activeSpan?.setAttribute('request.app', req.app);
    activeSpan?.setAttribute('request.ip', req.ip);
    activeSpan?.setAttribute('request.body', serializedBody);
    activeSpan?.setAttribute('request.query', serializedQuery);
    activeSpan?.setAttribute('request.osHostname', os.hostname());

    return next();
};
