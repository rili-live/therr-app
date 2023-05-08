import React from 'react';
import Chartist from 'react-chartist';
import ChartistTooltip from 'chartist-plugin-tooltips-updated';

export const CircleChart = (props) => {
    const { series = [], donutWidth = 20 } = props;
    const sum = (a, b) => a + b;

    const options = {
        low: 0,
        high: 8,
        donutWidth,
        donut: true,
        donutSolid: true,
        fullWidth: false,
        showLabel: false,
        labelInterpolationFnc: (value) => `${Math.round(value / series.reduce(sum) * 100)}%`,
    };

    const plugins = [
        ChartistTooltip(),
    ];

    return (
        <Chartist data={{ series }} options={{ ...options, plugins }} type="Pie" className="ct-golden-section" />
    );
};

export const BarChart = (props) => {
    const { labels = [], series = [], chartClassName = 'ct-golden-section' } = props;
    const data = { labels, series };

    const options = {
        low: 0,
        showArea: true,
        axisX: {
            position: 'end',
        },
        axisY: {
            showGrid: false,
            showLabel: false,
            offset: 0,
        },
    };

    const plugins = [
        ChartistTooltip(),
    ];

    return (
        <Chartist data={data} options={{ ...options, plugins }} type="Bar" className={chartClassName} />
    );
};
