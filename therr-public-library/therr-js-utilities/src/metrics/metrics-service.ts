import { Beeline, Configure } from 'honeycomb-beeline'; // eslint-disable-line import/newline-after-import
import {
    IMetric, IMetricCombined, IMetricDimensions, IMetricUniqueProperties, MetricsProvider,
} from './types';
import { InternalConfigHeaders } from '../internal-rest-request';
import DefaultMetricsProvider from './default-metrics-provider';

export default class MetricsService {
    private provider: MetricsProvider;

    constructor(metricsProvider?: MetricsProvider, logTracer?: Beeline & Configure) {
        if (!metricsProvider) {
            if (!logTracer) {
                throw new Error('Log tracer is required when using default metrics provider');
            }
            this.provider = new DefaultMetricsProvider(logTracer);
        }
        this.provider = metricsProvider;
    }

    uploadMetric = (
        metric: IMetric,
        dimensions: IMetricDimensions,
        headers: InternalConfigHeaders,
        uniqueDbProperties: IMetricUniqueProperties = {},
    ) => this.provider.uploadMetric(metric, dimensions, headers, uniqueDbProperties);

    uploadMetrics = (metrics: IMetricCombined[], headers: InternalConfigHeaders) => this.provider.uploadMetrics(metrics, headers);
}
