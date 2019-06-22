
import * as express from 'express';
import printLogs from 'rili-public-library/utilities/print-logs';
import * as httpResponse from 'rili-public-library/utilities/http-response';
import { shouldPrintSQLLogs } from '../server-api';

const handleError = (err: Error, res: express.Response) => {
    // TODO: Handle various error status codes
    printLogs({
        shouldPrintLogs: shouldPrintSQLLogs,
        messageOrigin: `SQL:USER_ROUTES:ERROR`,
        messages: [err.toString()],
    });
    res.status(500).send(httpResponse.error(500, err.toString()));
};

export default handleError;
