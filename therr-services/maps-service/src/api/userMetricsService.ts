import {
    MetricsService,
    IMetric,
    IMetricUniqueProperties,
    IMetricDimensions,
    IMetricCombined,
} from 'therr-js-utilities/metrics';
import { internalRestRequest, InternalConfigHeaders } from 'therr-js-utilities/internal-rest-request';
import * as globalConfig from '../../../../global-config';

export class UserMetricsProvider {
    // eslint-disable-next-line class-methods-use-this
    uploadMetric = (
        metric: IMetric,
        dimensions: IMetricDimensions,
        headers: InternalConfigHeaders,
        uniqueDbProperties: IMetricUniqueProperties = {},
    ) => internalRestRequest({
        // headers: {
        //     authorization: uniqueDbProperties.authorization, // Hijack this arg object (this will be replaced with actual metrics provider)
        //     'x-localecode': uniqueDbProperties.locale, // Hijack this arg object (this will be replaced with actual metrics provider)
        //     'x-userid': uniqueDbProperties.userId, // Hijack this arg object (this will be replaced with actual metrics provider)
        //     'x-therr-origin-host': uniqueDbProperties.originDomain || '',
        // },
        headers,
    }, { // Create companion reaction for user's own moment
        method: 'post',
        url: `${globalConfig[process.env.NODE_ENV].baseUsersServiceRoute}/users/metrics`,
        headers: {
            authorization: uniqueDbProperties.authorization, // Hijack this arg object (this will be replaced with actual metrics provider)
            'x-localecode': uniqueDbProperties.locale, // Hijack this arg object (this will be replaced with actual metrics provider)
            'x-userid': uniqueDbProperties.userId, // Hijack this arg object (this will be replaced with actual metrics provider)
            'x-therr-origin-host': uniqueDbProperties.originDomain || '',
        },
        data: {
            name: metric.name,
            contentUserId: uniqueDbProperties.contentUserId,
            dimensions,
            latitude: uniqueDbProperties?.latitude,
            longitude: uniqueDbProperties?.longitude,
            value: metric.value,
            valueType: metric.valueType,
        },
    });

    uploadMetrics = (metrics: IMetricCombined[], headers: InternalConfigHeaders) => Promise.all(
        metrics.map((metric) => this.uploadMetric(metric, metric.dimensions, headers, metric.uniqueDbProperties)),
    );
}

const userMetricsProvider = new UserMetricsProvider();

export default new MetricsService(userMetricsProvider);
