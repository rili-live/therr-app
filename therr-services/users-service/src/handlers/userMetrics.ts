import { ErrorCodes } from 'therr-js-utilities/constants';
import printLogs from 'therr-js-utilities/print-logs';
import beeline from '../beeline';
import handleHttpError from '../utilities/handleHttpError';
import translate from '../utilities/translator';
import Store from '../store';
import { ICreateUserMetricsParams } from '../store/UserMetricsStore';

// CREATE
const createUserMetric = async (req, res) => {
    const requestingUserId = req.headers['x-userid'];
    const authorization = req.headers.authorization;
    const locale = req.headers['x-localecode'] || 'en-us';

    const {
        name,
        contentUserId,
        dimensions,
        latitude,
        longitude,
        value,
        valueType,
    } = req.body;

    if (!contentUserId) {
        return handleHttpError({
            res,
            message: 'requires contentUserId',
            statusCode: 400,
        });
    }

    const params: ICreateUserMetricsParams = {
        userId: requestingUserId,
        name,
        latitude,
        longitude,
        contentUserId,
        dimensions,
        value,
        valueType,
    };

    return Store.userMetrics.create(params)
        .then(([metric]) => res.status(201).send({
            metric,
        }))
        .catch((err) => handleHttpError({ err, res, message: 'SQL:USERS_ROUTES:ERROR' }));
};

// READ
const getUserMetrics = (req, res) => {
    const requestingUserId = req.headers['x-userid'];
    const locale = req.headers['x-localecode'] || 'en-us';

    const { contentUserId } = req.params;

    printLogs({
        level: 'info',
        messageOrigin: 'API_SERVER',
        messages: ['User Metrics Fetched'],
        tracer: beeline,
        traceArgs: {
            // TODO: Add a sentiment analysis property
            action: 'fetch-user-metrics',
            userId: requestingUserId,
            contentUserId,
            logCategory: 'user-sentiment',
            locale,
        },
    });

    const {
        startDate,
        endDate,
    } = req.query;

    if (contentUserId === requestingUserId) {
        return Store.userMetrics.getForDateRange(startDate, endDate, {
            contentUserId: requestingUserId,
        })
            .then((results) => res.status(200).send({ metrics: results }))
            .catch((err) => handleHttpError({ err, res, message: 'SQL:USERS_ROUTES:ERROR' }));
    }

    // TODO: Allow searching across metrics for any user who has interacted with the requesting user's content
    // Ex.) Aggregate all userId metrics where contentUserId === requestingUserId, then fetch and aggregate
    // all metrics where userId in userIds
    // This could be useful if a business user wants to know the interests of their past customers
    // We can weight the results by customer loyalty
    return handleHttpError({
        res,
        message: translate(locale, 'metrics.mustBeOwner'),
        statusCode: 400,
        errorCode: ErrorCodes.METRIC_ACCESS_RESTRICTED,
    });
};

export {
    createUserMetric,
    getUserMetrics,
};
