import os from 'os';
import opentelemetry from '@opentelemetry/api';

export default (req, res, next) => {
    const serializedBody = {
        ...req.body,
    };
    if (req.body?.idToken) {
        serializedBody.idToken = 'XXREDACTEDXX';
    }
    if (req.body?.password) {
        serializedBody.password = 'XXREDACTEDXX';
    }
    if (req.body?.oneTimePassword) {
        serializedBody.oneTimePassword = 'XXREDACTEDXX';
    }
    if (req.body?.integrationsAccess) {
        serializedBody.integrationsAccess = 'XXREDACTEDXX';
    }

    const activeSpan = opentelemetry.trace.getActiveSpan();
    activeSpan?.setAttribute('request.app', req.app);
    activeSpan?.setAttribute('request.ip', req.ip);
    // activeSpan?.setAttribute('request.body', JSON.stringify(serializedBody));
    activeSpan?.setAttribute('request.osHostname', os.hostname());
    activeSpan?.setAttribute('request.originHost', req.headers['x-therr-origin-host']);

    return next();
};
