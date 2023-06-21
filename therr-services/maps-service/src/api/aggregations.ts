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
    let currentMetricSum = 0;
    let previousMetricSum = 0;
    const curValues = Object.values(currentSeries);
    const preValues = Object.values(previousSeries);

    for (let val = 0; val < curValues.length; val += 1) {
        currentMetricSum += currentSeries[val];
    }
    for (let val = 0; val < preValues.length; val += 1) {
        previousMetricSum += previousSeries[val];
    }

    return ((currentMetricSum - previousMetricSum) * 100) / previousMetricSum;
};

export { aggregateMetrics, getPercentageChange };
