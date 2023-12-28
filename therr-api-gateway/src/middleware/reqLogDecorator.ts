import os from 'os';
import opentelemetry from '@opentelemetry/api';
import { hostRegex } from '../utilities/patterns';

export default (req, res, next) => {
    const activeSpan = opentelemetry.trace.getActiveSpan();
    activeSpan?.setAttribute('request.app', req.app);
    activeSpan?.setAttribute('request.ip', req.ip);
    activeSpan?.setAttribute('request.osHostname', os.hostname());
    activeSpan?.setAttribute('request.originHost', req.headers.origin?.match(hostRegex)?.[1] || '');

    return next();
};
