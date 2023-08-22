import {
    MetricsService,
    IMetric,
    IMetricUniqueProperties,
    IMetricDimensions,
    IMetricCombined,
} from 'therr-js-utilities/metrics';
import Store from '../store';

export class UserMetricsProvider {
    // eslint-disable-next-line class-methods-use-this
    uploadMetric = (
        metric: IMetric,
        dimensions: IMetricDimensions,
        uniqueDbProperties: IMetricUniqueProperties = {},
    ) => Store.spaceMetrics.create([{
        name: metric.name,
        value: metric.value, // Replying to a should is weighted more than viewing or liking
        valueType: metric.valueType,
        userId: metric.userId,
        spaceId: uniqueDbProperties.spaceId,
        region: uniqueDbProperties.region,
        dimensions,
    }], {
        latitude: uniqueDbProperties?.latitude,
        longitude: uniqueDbProperties?.longitude,
    });

    // eslint-disable-next-line class-methods-use-this
    uploadMetrics = (
        metrics: IMetricCombined[],
    ) => {
        const metricParams = metrics.map((metric) => ({
            name: metric.name,
            value: metric.value, // Replying to a should is weighted more than viewing or liking
            valueType: metric.valueType,
            userId: metric.userId,
            spaceId: metric.uniqueDbProperties.spaceId,
            region: metric.uniqueDbProperties.region,
            dimensions: metric.dimensions,
        }));

        // Multiple metrics, 1 db request
        return Store.spaceMetrics.create(metricParams, {
            latitude: metrics[0].uniqueDbProperties?.latitude,
            longitude: metrics[0].uniqueDbProperties?.longitude,
        });
    };
}

const userMetricsProvider = new UserMetricsProvider();

export default new MetricsService(userMetricsProvider);
