import React from 'react';
import Chartist from 'react-chartist';
import ChartistTooltip from 'chartist-plugin-tooltips-updated';
// import { ApexOptions } from 'apexcharts';
// import ApexChart from 'react-apexcharts';

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
        series: values || [[0, 0, 0, 0, 0, 0, 0]],
    } : {
        labels: labels || ['Week 1', 'Week 2', 'Week 3', 'Week 4'],
        series: values || [[0, 0, 0, 0]],
    };
    const chartSeries = data.series.map((d) => ({
        name: 'Impressions',
        data: d,
    }));

    const chartistOptions = {
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
            labelInterpolationFnc: (value) => `${value}`,
        },
    };

    const options: any = {
        colors: ['#06A77D', '#4D4AE8', '#FD8E7A'],
        chart: {
            fontFamily: 'Inter',
            foreColor: '#4B5563',
            toolbar: {
                show: true,
                offsetX: 0,
                offsetY: 0,
                tools: {
                    download: false,
                    selection: false,
                    zoom: false,
                    zoomin: true,
                    zoomout: true,
                    pan: true,
                },
                // export: {
                //     csv: {
                //         filename: undefined,
                //         columnDelimiter: ',',
                //         headerCategory: 'category',
                //         headerValue: 'value',
                //         dateFormatter(timestamp) {
                //             return new Date(timestamp).toDateString();
                //         },
                //     },
                // },
                autoSelected: 'zoom',
            },
        },
        dataLabels: {
            enabled: false,
        },
        stroke: {
            curve: 'smooth',
        },
        fill: {
            type: 'solid',
            colors: ['#06A77D'],
            opacity: [0.1, 1],
        },
        // fill: {
        //     type:'solid',
        //     opacity: [0.35, 1],
        //   },
        grid: {
            show: true,
            borderColor: '#f2f2f2',
            strokeDashArray: 1,
        },
        xaxis: {
            categories: data.labels,
            labels: {
                style: {
                    fontSize: '12px',
                    fontWeight: 500,
                },
            },
            axisBorder: {
                color: '#ffffff',
            },
            axisTicks: {
                color: '#ffffff',
            },
        },
        yaxis: {
            labels: {
                style: {
                    colors: ['#4B5563'],
                    fontSize: '12px',
                    fontWeight: 500,
                },
            },
            // labelInterpolationFnc: (value) => `${value}`,
        },
        legend: {
            show: true,
            fontSize: '14px',
            fontFamily: 'Inter',
            fontWeight: 400,
            height: 60,
            tooltipHoverFormatter: undefined,
            offsetY: 20,
            markers: {
                width: 14,
                height: 14,
                strokeWidth: 1,
                strokeColor: '#fff',
                radius: 50,
            },
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
            <Chartist data={sampledData} options={{ ...chartistOptions, plugins }} type="Line" className="ct-series-g ct-major-tenth" />
        );
    }

    return (
        <Chartist data={data} options={{ ...chartistOptions, plugins }} type="Line" className="ct-series-g ct-double-octave" />
    );

    // Uncomment after fixing dependency compilation error
    // return (
    //     <ApexChart
    //         type="area"
    //         height={640}
    //         series={chartSeries}
    //         options={options}
    //     />
    // );
};
