import * as express from 'express';

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
