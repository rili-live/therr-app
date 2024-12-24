import {
    AccessLevels, CurrencyTransactionMessages, CurrentCheckInValuations, ErrorCodes, MetricNames, MetricValueTypes,
} from 'therr-js-utilities/constants';
import { parseHeaders } from 'therr-js-utilities/http';
import { internalRestRequest } from 'therr-js-utilities/internal-rest-request';
import logSpan from 'therr-js-utilities/log-or-update-span';
import handleHttpError from '../utilities/handleHttpError';
import translate from '../utilities/translator';
import Store from '../store';
import { aggregateMetrics, getPercentageChange, getMetricsByName } from '../api/aggregations';
import areaMetricsService from '../api/areaMetricsService';
import getUserOrganizations from '../utilities/getUserOrganizations';
import * as globalConfig from '../../../../global-config';
import incrementInterestEngagement from '../utilities/incrementInterestEngagement';

// CREATE
const createSpaceMetric = async (req, res) => {
    const reqPath = req.path;
    const {
        authorization,
        locale,
        platform,
        brandVariation,
        requestId,
        userDeviceToken,
        userId,
        userName,
        whiteLabelOrigin,
    } = parseHeaders(req.headers);

    const checkInCount = 1;
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

    const space = spaceId ? await Store.spaces.getById(spaceId).then((response) => response[0]) : {};

    if (spaceId && !space.id) {
        return handleHttpError({
            res,
            message: 'space not found',
            statusCode: 404,
        });
    }

    const params = spaceIds ? spaceIds.map((id) => ({
        // Security measure to ensure this endpoint isn't used to hijack the private metrics create route
        name: reqPath.includes('/check-in') ? MetricNames.SPACE_USER_CHECK_IN : name,
        spaceId: id,
        value,
        valueType,
        userId,
        userLatitude: latitude,
        userLongitude: longitude,
        dimensions: {
            userLatitude: latitude,
            userLongitude: longitude,
        },
    })) : [{
        // Security measure to ensure this endpoint isn't used to hijack the private metrics create route
        name: reqPath.includes('/check-in') ? MetricNames.SPACE_USER_CHECK_IN : name,
        spaceId,
        value,
        valueType,
        userId,
        userLatitude: latitude,
        userLongitude: longitude,
        dimensions: {
            userLatitude: latitude,
            userLongitude: longitude,
        },
    }];

    const rewardUserPromise = (spaceId && space.fromUserId && name === MetricNames.SPACE_USER_CHECK_IN && userId !== space.fromUserId)
        ? internalRestRequest({
            headers: req.headers,
        }, { // Create companion reaction for user's own moment
            method: 'post',
            url: `${globalConfig[process.env.NODE_ENV].baseUsersServiceRoute}/rewards/transfer-coins`,
            headers: {
                authorization,
                'x-localecode': locale,
                'x-userid': userId,
                'x-therr-origin-host': whiteLabelOrigin,
            },
            data: {
                fromUserId: space.fromUserId,
                toUserId: userId,
                amount: CurrentCheckInValuations[checkInCount],
            },
        }) : Promise.resolve({
            data: {
                transactionStatus: 'success',
                skippedTransfer: true,
            },
        });

    return rewardUserPromise.catch((error) => {
        // Catch and handle insufficient funds error so we can pass this error along to the frontend
        if (error?.response?.data?.errorCode === ErrorCodes.INSUFFICIENT_THERR_COIN_FUNDS) {
            return {
                data: {
                    transactionStatus: error?.response?.data?.message || CurrencyTransactionMessages.INSUFFICIENT_FUNDS,
                },
            };
        }

        // Let the error trickle down to our catch 500 block
        throw error;
    }).then((response) => {
        if (response?.data?.transactionStatus !== 'success') {
            // 3. If unsuccessful, return response with error. Frontend will show dialog
            // to user to confirm they want to create the space without the reward

            // TODO: Send e-mail to space owner to purchase more coins
            return handleHttpError({
                res,
                message: 'Business owner has insufficient funds',
                statusCode: 400,
                errorCode: ErrorCodes.INSUFFICIENT_THERR_COIN_FUNDS,
            });
        }

        // TODO: Send more descriptive messaging for reasons that transfer is skipped
        return areaMetricsService.uploadMetrics(params.map((param) => ({
            name: param.name || MetricNames.SPACE_IMPRESSION,
            value: param.value || '1',
            valueType: param.valueType || MetricValueTypes.NUMBER,
            userId,
            dimensions: param.dimension,
            userLatitude: param.userLatitude,
            userLongitude: param.userLongitude,
            uniqueDbProperties: {
                spaceId: param.spaceId,
                latitude: param.userLatitude,
                longitude: param.userLongitude,
            },
        })), {
            authorization,
            'x-platform': platform,
            'x-brand-variation': brandVariation,
            'x-therr-origin-host': whiteLabelOrigin,
            'x-localecode': locale,
            'x-requestid': requestId,
            'x-user-device-token': userDeviceToken,
            'x-userid': userId,
            'x-username': userName,
        }).then((metrics) => {
            if (reqPath.includes('/check-in')) {
                if (userId !== space.fromUserId) {
                    incrementInterestEngagement(space.interestsKeys, 3, req.headers);
                }
            }
            return res.status(201).send({
                metrics,
                therrCoinRewarded: response?.data?.skippedTransfer
                    ? 0
                    : CurrentCheckInValuations[checkInCount],
                isMySpace: userId === space.fromUserId,
            });
        });
    }).catch((err) => handleHttpError({ err, res, message: 'SQL:SPACES_ROUTES:ERROR' }));
};

const getFormattedMetrics = (startDate, endDate, spaceId, metricNames) => {
    const startDateTime = new Date(startDate).getTime();
    const endDateTime = new Date(endDate).getTime();
    const range = endDateTime - startDateTime - 1;
    const previousSeriesStartDate = new Date(startDateTime - range);
    const previousSeriesEndDate = startDate;
    const currentSeriesPromise = Store.spaceMetrics.getForDateRange(startDate, endDate, { spaceId, valueType: 'NUMBER' }, metricNames);
    const prevSeriesPromise = Store.spaceMetrics.getForDateRange(previousSeriesStartDate, previousSeriesEndDate, { spaceId, valueType: 'NUMBER' }, metricNames);

    return Promise.all(
        [
            currentSeriesPromise,
            prevSeriesPromise,
        ],
    );
};

const getSpaceMetrics = (req, res) => {
    const {
        userAccessLevels: accessLevels,
        locale,
        userId,
    } = parseHeaders(req.headers);
    const shouldTargetEngagements = req.path.includes('/engagement');

    const { spaceId } = req.params;

    return getUserOrganizations(req.headers).then((orgResults) => {
        const orgsWithReadAccess = orgResults.userOrganizations.filter((org) => (
            org.accessLevels.includes(AccessLevels.ORGANIZATIONS_ADMIN)
            || org.accessLevels.includes(AccessLevels.ORGANIZATIONS_BILLING)
            || org.accessLevels.includes(AccessLevels.ORGANIZATIONS_MANAGER)
            || org.accessLevels.includes(AccessLevels.ORGANIZATIONS_READ)
        ));

        return Store.spaces.getByIdSimple(spaceId)
            .then(([space]) => {
                logSpan({
                    level: 'info',
                    messageOrigin: 'API_SERVER',
                    messages: ['Space Metrics Fetched'],
                    traceArgs: {
                        // TODO: Add a sentiment analysis property
                        logCategory: 'user-sentiment',
                        action: 'fetch-space-metrics',
                        'space.category': space?.category,
                        'space.radius': space?.radius,
                        'space.spaceId': space?.id,
                        'space.isPublic': space?.isPublic,
                        'space.region': space?.region,
                        'space.isMatureContent': space?.isMatureContent,
                        'user.locale': locale,
                        'user.id': userId,
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
                if (space?.fromUserId !== userId && !accessLevels?.includes(AccessLevels.SUPER_ADMIN)
                    && !orgsWithReadAccess?.map((org) => org.organizationId)?.includes(space?.organizationId)) {
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
                let metricNames = [MetricNames.SPACE_PROSPECT, MetricNames.SPACE_IMPRESSION, MetricNames.SPACE_VISIT];
                if (shouldTargetEngagements) {
                    metricNames = [MetricNames.SPACE_LIKE, MetricNames.SPACE_USER_CHECK_IN, MetricNames.SPACE_MOMENT_CREATED];
                }
                return getFormattedMetrics(startDate, endDate, spaceId, metricNames).then(([currMetrics, prevMetrics]) => {
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
    });
};

export {
    createSpaceMetric,
    getSpaceMetrics,
};
