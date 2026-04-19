import os from 'os';
import opentelemetry from '@opentelemetry/api';

const REDACTED = 'XXREDACTEDXX';
const redactedBodyKeys = ['idToken', 'password', 'oneTimePassword', 'integrationsAccess'];
const redactedQueryKeys = ['idToken', 'access_token'];

const redact = (source: Record<string, any> | undefined, keys: string[]): Record<string, any> => {
    const out = { ...(source || {}) };
    keys.forEach((key) => {
        if (out[key] !== undefined) {
            out[key] = REDACTED;
        }
    });
    return out;
};

// Opt-in via env because request bodies can be large and contain PII.
const shouldLogBody = process.env.LOG_REQUEST_BODY === 'true';

export default (req, res, next) => {
    const serializedBody = redact(req.body, redactedBodyKeys);
    const serializedQuery = redact(req.query, redactedQueryKeys);

    const activeSpan = opentelemetry.trace.getActiveSpan();
    activeSpan?.setAttribute('request.app', req.app);
    activeSpan?.setAttribute('request.ip', req.ip);
    if (shouldLogBody) {
        activeSpan?.setAttribute('request.body', JSON.stringify(serializedBody));
    }
    activeSpan?.setAttribute('request.query', JSON.stringify(serializedQuery));
    activeSpan?.setAttribute('request.osHostname', os.hostname());
    activeSpan?.setAttribute('request.originHost', req.headers['x-therr-origin-host']);

    return next();
};
