
import * as express from 'express';
import beeline from '../beeline';

interface IErrorArgs {
    err?: Error;
    res: express.Response;
    message: string;
    statusCode?: number;
}

const handleHttpError = ({
    err,
    res,
    message,
    statusCode,
}: IErrorArgs) => {
    const trace = beeline.startTrace({
        errorMessage: err ? err.stack : message,
    });
    beeline.finishTrace(trace);

    return res.status(statusCode || 500).send({
        statusCode: statusCode || 500,
        message,
    });
};

export default handleHttpError;
