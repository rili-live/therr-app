
import * as express from 'express';
import printLogs from 'rili-public-library/utilities/print-logs.js';
import * as httpResponse from 'rili-public-library/utilities/http-response.js';
import { shouldPrintSQLLogs } from '../server-api';

const handleError = (err: Error, res: express.Response) => {
    // TODO: Handle various error status codes
    printLogs({
        shouldPrintLogs: shouldPrintSQLLogs,
        messageOrigin: 'SQL:USER_ROUTES:ERROR',
        messages: [err.toString()],
    });
    return res.status(500).send(httpResponse.error({
        message: err.toString(),
        statusCode: 500,
    }));
};

export default handleError;
