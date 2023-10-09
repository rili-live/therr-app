import { MetricNames, MetricValueTypes } from '../constants';

export interface IMetricDimensions {
    [key: string]: any;
}

export interface IMetricUniqueProperties {
    [key: string]: any;
}

export interface IMetric {
    name: MetricNames;
    value: any;
    valueType: MetricValueTypes;
    userId: string;
    userLatitude?: number;
    userLongitude?: number;
}

export interface IMetricCombined extends IMetric {
    dimensions: IMetricDimensions;
    uniqueDbProperties: IMetricUniqueProperties;
}

export abstract class MetricsProvider {
    // eslint-disable-next-line no-useless-constructor, @typescript-eslint/no-empty-function
    constructor() {}

    // eslint-disable-next-line class-methods-use-this
    abstract uploadMetric: (
        metric: IMetric,
        dimensions: IMetricDimensions,
        uniqueDbProperties?: IMetricUniqueProperties,
    ) => Promise<any>

    // eslint-disable-next-line class-methods-use-this
    abstract uploadMetrics:(metrics: IMetricCombined[]) => Promise<any[]>
}
