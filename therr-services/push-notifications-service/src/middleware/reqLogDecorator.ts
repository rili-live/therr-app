import os from 'os';
import opentelemetry from '@opentelemetry/api';

export default (req, res, next) => {
    const activeSpan = opentelemetry.trace.getActiveSpan();
    activeSpan?.setAttribute('request.app', req.app);
    activeSpan?.setAttribute('request.ip', req.ip);
    activeSpan?.setAttribute('request.body', req.body);
    activeSpan?.setAttribute('request.osHostname', os.hostname());
    activeSpan?.setAttribute('request.originHost', req.headers['x-therr-origin-host']);

    return next();
};
