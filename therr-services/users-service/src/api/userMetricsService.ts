import { MetricsService } from 'therr-js-utilities/metrics';
import {
    IMetric,
    IMetricUniqueProperties,
    IMetricDimensions,
} from 'therr-js-utilities/metrics/types';
import Store from '../store';

export class UserMetricsProvider {
    // eslint-disable-next-line class-methods-use-this
    uploadMetric = (
        metric: IMetric,
        dimensions: IMetricDimensions,
        uniqueDbProperties: IMetricUniqueProperties = {},
    ) => Store.userMetrics.create({
        name: metric.name,
        value: metric.value, // Replying to a should is weighted more than viewing or liking
        valueType: metric.valueType,
        userId: metric.userId,
        contentUserId: uniqueDbProperties.contentUserId,
        dimensions,
    });
}

const userMetricsProvider = new UserMetricsProvider();

export default new MetricsService(userMetricsProvider);
