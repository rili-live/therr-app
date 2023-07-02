const getMetricsByName = (metrics, names) => {
    const metricsByName: any = {};

    metrics.forEach((metric) => {
        if (metricsByName[metric.name]) {
            metricsByName[metric.name].push(metric);
        } else {
            metricsByName[metric.name] = [metric];
        }
    });

    return metricsByName;
};

const aggregateMetrics = (metrics) => {
    const formattedMetrics = {};

    metrics.forEach((metric) => {
        const month = new Date(metric.createdAt).getUTCMonth() + 1;
        const dayOfMonth = new Date(metric.createdAt).getUTCDate();
        const dataKey = `${month}/${dayOfMonth}`;
        formattedMetrics[dataKey] = formattedMetrics[dataKey] !== undefined
            ? formattedMetrics[dataKey] + Number(metric.value)
            : Number(metric.value);
    });
    return formattedMetrics;
};

const getPercentageChange = (currentSeries, previousSeries) => {
    const currentMetricSum = currentSeries.reduce((a, b) => {
        if (b === 0) {
            return Number(a.value || 0);
        }
        return Number(a.value || 0) + Number(b.value || 0);
    }, 0);
    const previousMetricSum = previousSeries.reduce((a, b) => {
        if (b === 0) {
            return Number(a.value || 0);
        }
        return Number(a.value || 0) + Number(b.value || 0);
    }, 0);

    if (previousMetricSum === 0) {
        return 100;
    }

    return ((currentMetricSum - previousMetricSum) * 100) / previousMetricSum;
};

export { aggregateMetrics, getPercentageChange, getMetricsByName };
