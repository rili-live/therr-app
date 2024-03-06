import debug from 'debug';
import * as express from 'express';
import opentelemetry from '@opentelemetry/api';
import { ErrorCodes } from '../constants';

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

    return res.status(statusCode || 500).send({
        statusCode: statusCode || 500,
        message,
        errorCode: errorCode || ErrorCodes.UNKNOWN_ERROR,
        ...resBody,
    });
};

export default configureHandleHttpError;
