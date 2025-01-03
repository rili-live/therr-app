import { ErrorCodes } from 'therr-js-utilities/constants';
import logSpan from 'therr-js-utilities/log-or-update-span';
import { parseHeaders } from 'therr-js-utilities/http';
import handleHttpError from '../utilities/handleHttpError';
import translate from '../utilities/translator';
import Store from '../store';
import userMetricsService from '../api/userMetricsService';

// CREATE
const createUserMetric = async (req, res) => {
    const requestingUserId = req.headers['x-userid'];

    const {
        authorization,
        locale,
        platform,
        brandVariation,
        whiteLabelOrigin,
        requestId,
        userDeviceToken,
        userId,
        userName,
    } = parseHeaders(req.headers);

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

    userMetricsService.uploadMetric({
        name,
        value,
        valueType,
        userId: requestingUserId,
    }, {
        ...dimensions,
    }, {
        authorization,
        'x-platform': platform,
        'x-brand-variation': brandVariation,
        'x-therr-origin-host': whiteLabelOrigin,
        'x-localecode': locale,
        'x-requestid': requestId,
        'x-user-device-token': userDeviceToken,
        'x-userid': userId,
        'x-username': userName,
    }, {
        contentUserId,
        latitude,
        longitude,
    }).then(([metric]) => res.status(201).send({
        metric,
    })).catch((err) => handleHttpError({ err, res, message: 'SQL:USERS_ROUTES:ERROR' }));
};

// READ
const getUserMetrics = (req, res) => {
    const requestingUserId = req.headers['x-userid'];
    const locale = req.headers['x-localecode'] || 'en-us';

    const { contentUserId } = req.params;

    logSpan({
        level: 'info',
        messageOrigin: 'API_SERVER',
        messages: ['User Metrics Fetched'],
        traceArgs: {
            // TODO: Add a sentiment analysis property
            action: 'fetch-user-metrics',
            logCategory: 'user-sentiment',
            'user.id': requestingUserId,
            'metrics.contentUserId': contentUserId,
            'user.locale': locale,
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
const getMomentMetrics = (req, res) => {
    const { momentId } = req.params;

    return Store.userMetrics.countWhere('momentId', momentId)
        .then(([{ count: viewCount }]) => res.status(200).send({
            metrics: {
                viewCount: parseInt(viewCount || '0', 10),
            },
        }))
        .catch((err) => handleHttpError({ err, res, message: 'SQL:USERS_ROUTES:ERROR' }));
};

export {
    createUserMetric,
    getMomentMetrics,
    getUserMetrics,
};
