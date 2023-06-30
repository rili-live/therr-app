import { AccessLevels, ErrorCodes, MetricNames } from 'therr-js-utilities/constants';
import printLogs from 'therr-js-utilities/print-logs';
import beeline from '../beeline';
import handleHttpError from '../utilities/handleHttpError';
import translate from '../utilities/translator';
import Store from '../store';
import { aggregateMetrics, getPercentageChange, getMetricsByName } from '../api/aggregations';
// CREATE
const createSpaceMetric = async (req, res) => {
    const authorization = req.headers.authorization;
    const locale = req.headers['x-localecode'] || 'en-us';
    const userId = req.headers['x-userid'];

    const {
        name,
        spaceId,
        spaceIds,
        value,
        valueType,
        longitude,
        latitude,
    } = req.body;

    if (!spaceId && !(spaceIds || !spaceIds.length)) {
        return handleHttpError({
            res,
            message: 'requires spaceId or spaceIds',
            statusCode: 400,
        });
    }

    const params = spaceIds ? spaceIds.map((id) => ({
        name,
        spaceId: id,
        value,
        valueType,
        userId,
        dimensions: {
            userLatitude: latitude,
            userLongitude: longitude,
        },
    })) : [{
        name,
        spaceId,
        value,
        valueType,
        userId,
        dimensions: {
            userLatitude: latitude,
            userLongitude: longitude,
        },
    }];

    return Store.spaceMetrics.create(params, {
        longitude,
        latitude,
    })
        .then(([metric]) => res.status(201).send({
            metric,
        }))
        .catch((err) => handleHttpError({ err, res, message: 'SQL:SPACES_ROUTES:ERROR' }));
};

const getFormattedMetrics = (startDate, endDate, spaceId) => {
    const startDateTime = new Date(startDate).getTime();
    const endDateTime = new Date(endDate).getTime();
    const range = endDateTime - startDateTime - 1;
    const previousSeriesStartDate = new Date(startDateTime - range);
    const previousSeriesEndDate = startDate;
    const currentSeriesPromise = Store.spaceMetrics.getForDateRange(startDate, endDate, { spaceId, valueType: 'NUMBER' });
    const prevSeriesPromise = Store.spaceMetrics.getForDateRange(previousSeriesStartDate, previousSeriesEndDate, { spaceId, valueType: 'NUMBER' });

    return Promise.all(
        [
            currentSeriesPromise,
            prevSeriesPromise,
        ],
    );
};

// READ
const getSpaceMetrics = (req, res) => {
    const userId = req.headers['x-userid'];
    const userAccessLevels = req.headers['x-user-access-levels'];
    const locale = req.headers['x-localecode'] || 'en-us';
    const accessLevels = userAccessLevels ? JSON.parse(userAccessLevels) : [];

    const { spaceId } = req.params;

    return Store.spaces.getByIdSimple(spaceId)
        .then(([space]) => {
            printLogs({
                level: 'info',
                messageOrigin: 'API_SERVER',
                messages: ['Space Metrics Fetched'],
                tracer: beeline,
                traceArgs: {
                    // TODO: Add a sentiment analysis property
                    action: 'fetch-space-metrics',
                    category: space?.category,
                    radius: space?.radius,
                    spaceId: space?.id,
                    isPublic: space?.isPublic,
                    logCategory: 'user-sentiment',
                    userId,
                    region: space?.region,
                    isMatureContent: space?.isMatureContent,
                    locale,
                },
            });
            if (!space) {
                return handleHttpError({
                    res,
                    message: translate(locale, 'spaces.notFound'),
                    statusCode: 404,
                    errorCode: ErrorCodes.NOT_FOUND,
                });
            }
            if (space?.fromUserId !== userId && !accessLevels?.includes(AccessLevels.SUPER_ADMIN)) {
                return handleHttpError({
                    res,
                    message: translate(locale, 'spaces.mustBeOwner'),
                    statusCode: 400,
                    errorCode: ErrorCodes.METRIC_ACCESS_RESTRICTED,
                });
            }

            const {
                startDate,
                endDate,
            } = req.query;
            return getFormattedMetrics(startDate, endDate, spaceId).then(([currMetrics, prevMetrics]) => {
                const metricNames = [MetricNames.SPACE_PROSPECT, MetricNames.SPACE_IMPRESSION, MetricNames.SPACE_VISIT];
                const groupedCurrentMetrics = getMetricsByName(
                    currMetrics,
                    metricNames,
                );
                const groupedPreviousMetrics = getMetricsByName(
                    prevMetrics,
                    metricNames,
                );
                const aggregations: any = {};
                Object.keys(groupedCurrentMetrics).forEach((key) => {
                    const previousSeriesPct = getPercentageChange(
                        groupedCurrentMetrics[key] || [],
                        groupedPreviousMetrics[key] || [],
                    );
                    aggregations[key] = {
                        metrics: aggregateMetrics(groupedCurrentMetrics[key] || []),
                        previousSeriesPct,
                    };
                });

                return res.status(200).send({
                    space,
                    metrics: groupedCurrentMetrics,
                    aggregations,
                });
            });
        }).catch((err) => handleHttpError({ err, res, message: 'SQL:SPACES_ROUTES:ERROR' }));
};

export {
    createSpaceMetric,
    getSpaceMetrics,
};
