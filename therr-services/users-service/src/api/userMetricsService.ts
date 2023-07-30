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
    ) => {
        let latLng;

        if (uniqueDbProperties.latitude && uniqueDbProperties.longitude) {
            latLng = {
                latitude: uniqueDbProperties.latitude,
                longitude: uniqueDbProperties.longitude,
            };
        }

        return Store.userMetrics.create({
            name: metric.name,
            value: metric.value, // Replying to a should is weighted more than viewing or liking
            valueType: metric.valueType,
            userId: metric.userId,
            contentUserId: uniqueDbProperties.contentUserId,
            dimensions,
        }, latLng);
    };

    uploadMetrics = (metrics: IMetricCombined[]) => Promise.all(
        metrics.map((metric) => this.uploadMetric(metric, metric.dimensions, metric.uniqueDbProperties)),
    );
}

const userMetricsProvider = new UserMetricsProvider();

export default new MetricsService(userMetricsProvider);
