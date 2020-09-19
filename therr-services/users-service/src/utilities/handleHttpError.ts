import debug from 'debug';
import * as express from 'express';
import beeline from '../beeline';

interface IErrorArgs {
    err?: Error;
    res: express.Response;
    message: string;
    resBody?: any;
    statusCode?: number;
}

const debugHttp = debug('http');

const handleHttpError = ({
    err,
    res,
    message,
    resBody,
    statusCode,
}: IErrorArgs) => {
    debugHttp((err && err.message) || err);
    beeline.addContext({
        errorMessage: err ? err.stack : message,
    });

    return res.status(statusCode || 500).send({
        statusCode: statusCode || 500,
        message,
        ...resBody,
    });
};

export default handleHttpError;
