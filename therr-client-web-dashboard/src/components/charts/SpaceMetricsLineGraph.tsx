import React from 'react';
import Chartist from 'react-chartist';
import ChartistTooltip from 'chartist-plugin-tooltips-updated';

interface ISpaceMetricsLineGraphProps {
    isMobile: boolean,
    timeSpan: string,
    labels: string[],
    values: number[][],
}

export const SpaceMetricsLineGraph = ({
    isMobile,
    timeSpan,
    labels,
    values,
}: ISpaceMetricsLineGraphProps) => {
    const data = timeSpan === 'week' ? {
        labels: labels || ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
        series: values || [[1, 2, 5, 3, 3, 7, 3]],
    } : {
        labels: labels || ['Week 1', 'Week 2', 'Week 3', 'Week 4'],
        series: values || [[10, 18, 8, 22]],
    };

    const options = {
        low: 0,
        showArea: true,
        fullWidth: true,
        axisX: {
            position: 'end',
            showGrid: true,
        },
        axisY: {
            // On the y-axis start means left and end means right
            showGrid: false,
            showLabel: false,
            labelInterpolationFnc: (value) => `$${value / 1}k`,
        },
    };

    const plugins = [
        ChartistTooltip(),
    ];

    if (isMobile) {
        let sampledData = data;

        if (timeSpan === 'month') {
            const sampledLabels = [];
            const sampledValues = [];
            const every = 3;

            for (let i = 0; i < (labels || []).length; i += every) {
                sampledLabels.push(labels[i]);
            }
            (values || []).forEach((valueArr, index) => {
                for (let i = 0; i < valueArr.length; i += every) {
                    if (!sampledValues[index]) {
                        sampledValues[index] = [];
                    }
                    sampledValues[index].push(values[index][i]);
                }
            });

            sampledData = {
                labels: sampledLabels,
                series: sampledValues,
            };
        }

        return (
            <Chartist data={sampledData} options={{ ...options, plugins }} type="Line" className="ct-series-g ct-major-tenth" />
        );
    }

    return (
        <Chartist data={data} options={{ ...options, plugins }} type="Line" className="ct-series-g ct-double-octave" />
    );
};
