import { MetricNames, MetricValueTypes } from 'therr-js-utilities/constants';
import logSpan from 'therr-js-utilities/log-or-update-span';
import Store from '../store';

/**
 * Fire-and-forget funnel event recorder. Every call is best-effort: metric
 * writes must never fail or slow a user-facing flow, so errors are logged and
 * swallowed. Events land in main.userMetrics where per-brand conversion and
 * viral coefficient can be computed (see RETENTION_AUDIT.md §3.2).
 */
const recordFunnelMetric = (
    name: MetricNames,
    userId: string,
    dimensions: { [key: string]: string } = {},
    value = '1',
): Promise<any> => {
    if (!userId) {
        return Promise.resolve();
    }

    return Store.userMetrics.create({
        name,
        userId,
        value,
        valueType: MetricValueTypes.NUMBER,
        dimensions,
    }).catch((err) => {
        logSpan({
            level: 'warn',
            messageOrigin: 'API_SERVER',
            messages: [err?.message, 'Failed to record funnel metric'],
            traceArgs: { 'metric.name': name, 'user.id': userId },
        });
    });
};

export default recordFunnelMetric;
