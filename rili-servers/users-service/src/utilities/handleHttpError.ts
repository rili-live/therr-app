
import * as express from 'express';
import beeline from '../beeline';

interface IErrorArgs {
    err?: Error;
    res: express.Response;
    message: string;
    resBody?: any;
    statusCode?: number;
}

const handleHttpError = ({
    err,
    res,
    message,
    resBody,
    statusCode,
}: IErrorArgs) => {
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
