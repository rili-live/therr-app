import debug from 'debug';
import * as express from 'express';
import opentelemetry from '@opentelemetry/api';
import { ErrorCodes } from '../constants';
import logOrUpdateSpan from '../log-or-update-span';

const debugHttp = debug('http');

export interface IErrorArgs {
    err?: Error;
    res: express.Response;
    message: string;
    resBody?: any;
    statusCode?: number;
    errorCode?: string;
}

const configureHandleHttpError = () => ({
    err,
    res,
    message,
    resBody,
    statusCode,
    errorCode,
}: IErrorArgs) => {
    debugHttp((err && err.message) || err || message);

    const activeSpan = opentelemetry?.trace?.getActiveSpan();
    activeSpan?.setAttribute('error.message', err?.message);
    activeSpan?.setAttribute('error.stack', err?.stack);

    // Put the underlying error on stdout for any 5xx that carries one.
    //
    // Until this existed a server error reached exactly two places: `debug`, which is
    // off unless DEBUG is set, and a Honeycomb span attribute. Neither is the container
    // log, which is what GKE ships to Cloud Logging and what
    // `_bin/prod-debug/collect-incident.sh` reads — so the only failures a digest could
    // ever surface were the ones the pg pool happened to log on its own. On 2026-09-20
    // every habits check-in returned `SQL:HABIT_CHECKINS_ROUTES:ERROR` for a day with
    // nothing in the logs to say why.
    //
    // Only 5xx, and only when there is an `err`: a 4xx is the API working (a validation
    // message, a 404), and logging those at error level would bury the real ones.
    // `message` rides along as the label, which is what makes these tokens worth having.
    if ((statusCode || 500) >= 500 && err) {
        logOrUpdateSpan({
            level: 'error',
            messageOrigin: 'API_SERVER',
            messages: [message],
            traceArgs: {
                'error.message': err.message,
                'error.stack': err.stack,
            },
        });
    }

    return res.status(statusCode || 500).send({
        statusCode: statusCode || 500,
        message,
        errorCode: errorCode || ErrorCodes.UNKNOWN_ERROR,
        ...resBody,
    });
};

export default configureHandleHttpError;
