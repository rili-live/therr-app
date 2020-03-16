
import * as express from 'express';
import printLogs from 'rili-public-library/utilities/print-logs.js';
import * as httpResponse from 'rili-public-library/utilities/http-response.js';

const handleError = (err: Error, res: express.Response, label: string) => {
    // TODO: Handle various error status codes
    printLogs({
        level: 'error',
        messageOrigin: label,
        messages: [err.toString()],
    });
    return res.status(500).send(httpResponse.error({
        message: err.toString(),
        statusCode: 500,
    }));
};

export default handleError;
