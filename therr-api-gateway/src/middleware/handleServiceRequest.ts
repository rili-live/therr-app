import { v4 as uuidv4 } from 'uuid';
// import opentelemetry from '@opentelemetry/api';
import logSpan from 'therr-js-utilities/log-or-update-span';
import handleHttpError from '../utilities/handleHttpError';
import restRequest from '../utilities/restRequest';
import isBlacklisted, { isBlacklistedEmail } from '../utilities/isBlacklisted';
import { hostRegex } from '../utilities/patterns';

interface IHandleServiceRequestArgs {
    basePath: string;
    method: string;
    overrideUrl?: string;
}

const handleServiceRequest = ({
    basePath,
    method,
    overrideUrl,
}: IHandleServiceRequestArgs, updateCache?: (result: any, reqBody?: any) => void) => (req, res) => {
    const config: any = {
        headers: {
            authorization: req.headers.authorization || '',
            'x-requestid': uuidv4(),
            'x-localecode': req.headers['x-localecode'] || '',
            'x-platform': req.headers['x-platform'] || '',
            'x-brand-variation': req.headers['x-brand-variation'] || '',
            'x-user-device-token': req.headers['x-user-device-token'] || '',
            // (securely) Tacked on from JWT decode
            'x-userid': req.headers['x-userid'] || req['x-userid'] || '',
            'x-username': req.headers['x-username'] || req['x-username'] || '',
            'x-user-access-levels': req.headers['x-user-access-levels'] || req['x-user-access-levels'] || '',
            'x-organizations': req.headers['x-organizations'] || req['x-organizations'] || '',
            'x-therr-origin-host': req.headers.origin?.match(hostRegex)?.[1] || '',
            'x-auth-type': req['x-auth-type'] || '',
            'x-correction-identity-hash': req.headers['x-correction-identity-hash'] || '',
        },
        method,
        url: `${basePath}${overrideUrl || req.url}`,
    };

    if (method !== 'get') {
        config.data = req.body;
    }

    if (isBlacklistedEmail(req?.body?.email || req?.body?.userName)) {
        return handleHttpError({
            err: new Error('E-mail address is blacklisted'),
            res,
            message: 'Invalid request. Please try again later.',
            statusCode: 400,
        });
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
                updateCache(response.data, req.body);
            }
            return res.send(response.data);
        })
        .catch((error) => {
            if (error?.response?.status === 301) {
                return res.status(301).redirect(error.response.data.redirectUrl);
            }

            if (!error.response) {
                if (error?.message?.includes('ECONNREFUSED')) {
                    logSpan({
                        level: 'error',
                        messageOrigin: 'API_SERVER',
                        messages: ['ECONNREFUSED'],
                        traceArgs: {
                            'request.hasConnectionError': true,
                            'request.targetHost': req.host,
                            'request.targetPath': basePath,
                        },
                    });
                }
                console.log(error);
            }

            // Structured upstream service errors are already sanitized and safe to forward.
            // Unstructured Node.js errors (network failures, etc.) may contain stack traces or
            // schema details — suppress them in production; log the raw error server-side above.
            const clientMessage = error?.response?.data?.message
                || (process.env.NODE_ENV !== 'production' ? (error?.message || 'Unknown error') : 'An unexpected error occurred');

            const upstreamBody = error?.response?.data;
            // Only a plain object is safe to spread onto the response. An ingress or
            // sidecar answering with an HTML error page hands us a string, and
            // spreading that would emit one numeric key per character.
            const isStructuredBody = !!upstreamBody
                && typeof upstreamBody === 'object'
                && !Array.isArray(upstreamBody);

            // The upstream's real HTTP status wins, and is read *before* the body's
            // `statusCode`. Most handlers answer through `handleHttpError`, which
            // echoes the status into the body, so the two agree. But a handler that
            // calls `res.status(x).send({ ... })` directly sends no `statusCode` key
            // at all — and every Friends with Habits gate does exactly that: 402
            // `habit-limit-reached`, 403 `solo-locked`, 409 on a purchase conflict.
            // Reading the body first turned all of them into a 500.
            const statusCode = error?.response?.status
                || (isStructuredBody && upstreamBody.statusCode)
                || 500;

            return handleHttpError({
                err: error,
                res,
                message: clientMessage,
                statusCode,
                errorCode: (isStructuredBody && upstreamBody.errorCode) || 500,
                // Forward the rest of the upstream payload rather than rebuilding a
                // bare { statusCode, message, errorCode }. The status alone is not
                // enough for a client to act on a gate: the mobile paywall reads
                // `error` and `limit`, and the solo-unlock prompt reads
                // `invitedCount` / `requiredCount`. Rebuilding dropped all of them.
                resBody: isStructuredBody ? upstreamBody : undefined,
            });
        });
};

export default handleServiceRequest;
