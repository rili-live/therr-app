import { ErrorCodes } from 'therr-js-utilities/constants';
import printLogs from 'therr-js-utilities/print-logs';
import beeline from '../beeline';
import handleHttpError from '../utilities/handleHttpError';
import translate from '../utilities/translator';
import Store from '../store';

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

// READ
const getSpaceMetrics = (req, res) => {
    const userId = req.headers['x-userid'];
    const locale = req.headers['x-localecode'] || 'en-us';

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
                    category: space.category,
                    radius: space.radius,
                    spaceId: space.id,
                    isPublic: space.isPublic,
                    logCategory: 'user-sentiment',
                    userId,
                    region: space.region,
                    isMatureContent: space.isMatureContent,
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
            if (space?.fromUserId !== userId) {
                return handleHttpError({
                    res,
                    message: translate(locale, 'spaces.mustBeOwner'),
                    statusCode: 400,
                    errorCode: ErrorCodes.SPACE_ACCESS_RESTRICTED,
                });
            }

            const {
                startDate,
                endDate,
            } = req.query;

            // TODO: Fetch own reaction or reaction count for own space
            return Store.spaceMetrics.getForDateRange(startDate, endDate, {
                spaceId,
            }).then((results) => res.status(200).send({ space, metrics: results }));
        }).catch((err) => handleHttpError({ err, res, message: 'SQL:SPACES_ROUTES:ERROR' }));
};

export {
    createSpaceMetric,
    getSpaceMetrics,
};
