import { Beeline, Configure } from 'honeycomb-beeline'; // eslint-disable-line import/newline-after-import
import printLogs from '../print-logs';
import {
    IMetric, IMetricCombined, IMetricDimensions, IMetricUniqueProperties, MetricsProvider,
} from './types';

export default class DefaultMetricsProvider {
    private loggingTracer;

    constructor(logTracer: Beeline & Configure) {
        this.loggingTracer = logTracer;
    }

    uploadMetric = (metric: IMetric, dimensions: IMetricDimensions, uniqueDbProperties: IMetricUniqueProperties = {}) => Promise.resolve(
        printLogs({
            level: 'info',
            messageOrigin: 'DefaultMetricsProvider',
            messages: ['new-metric'],
            tracer: this.loggingTracer,
            traceArgs: {
                metricName: metric.name,
                metricValue: metric.value,
                metricType: metric.valueType,
                metricUserId: metric.userId,
                ...dimensions,
                ...uniqueDbProperties,
            },
        }),
    );

    uploadMetrics = (metrics: IMetricCombined[]) => Promise.all(
        metrics.map((metric) => this.uploadMetric(metric, metric.dimensions, metric.uniqueDbProperties)),
    );
}
