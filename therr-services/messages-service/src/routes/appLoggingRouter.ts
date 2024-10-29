import * as express from 'express';
import { ILogLevel } from 'therr-js-utilities/constants';
import logSpan from 'therr-js-utilities/log-or-update-span';
import { parseHeaders } from 'therr-js-utilities/http';

const router = express.Router();

const isValidLogLevel = (logLevel): logLevel is ILogLevel => (
    logLevel && ['error', 'warn', 'info', 'http', 'verbose', 'debug', 'silly'].includes(logLevel)
);

const getLogLevel = (level?: string): ILogLevel => {
    if (isValidLogLevel(level)) {
        return level;
    }

    return 'info';
};

// CREATE
router.post('/', (req, res) => {
    const {
        userId,
        whiteLabelOrigin,
        brandVariation,
        platform,
    } = parseHeaders(req.headers);

    const logLevel = getLogLevel(req.query.logLevel?.toString());

    logSpan({
        level: logLevel,
        messageOrigin: 'API_SERVER',
        messages: ['message received from therr logger'],
        traceArgs: {
            ...req.body,
            brandVariation,
            'user.id': userId,
            whiteLabelOrigin,
            platform,
        },
    });

    return res.status(200).send({});
});

export default router;
