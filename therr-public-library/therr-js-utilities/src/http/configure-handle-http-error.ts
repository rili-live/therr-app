import debug from 'debug';
import * as express from 'express';

const debugHttp = debug('http');

export interface IErrorArgs {
    err? : Error;
    res: express.Response;
    message: string;
    resBody? : any;
    statusCode? : number;
}

const configureHandleHttpError = (beeline: any) => ({
    err,
    res,
    message,
    resBody,
    statusCode,
}: IErrorArgs) => {
    debugHttp((err && err.message) || err || message);
    beeline.addContext({
        errorMessage: err ? err.stack : message,
    });

    return res.status(statusCode || 500).send({
        statusCode: statusCode || 500,
        message,
        ...resBody,
    });
};

export default configureHandleHttpError;
