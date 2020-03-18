
import * as express from 'express';
import * as httpResponse from 'rili-public-library/utilities/http-response.js';
import beeline from '../beeline';

interface IErrorArgs {
    err: Error;
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
    beeline.withSpan({
        errorMessage: err.stack,
    }, () => res.status(statusCode || 500).send(httpResponse.error({
        statusCode: statusCode || 500,
        message,
    })));
};

export default handleHttpError;
