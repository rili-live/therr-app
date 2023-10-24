import React from 'react';
import Chartist from 'react-chartist';
import ChartistTooltip from 'chartist-plugin-tooltips-updated';
// import { ApexOptions } from 'apexcharts';
// import ApexChart from 'react-apexcharts';

interface ISpaceMetricsLineGraphProps {
    isMobile: boolean,
    timeSpan: string,
    labels: string[],
    values: number[][], // [[Visits],[Prospects],[Impressions]] // [[Likes],[CheckIns],[Moments]] etc.
    hoverLabels: string[],
}

export const SpaceMetricsLineGraph = ({
    isMobile,
    timeSpan,
    labels,
    values,
    hoverLabels,
}: ISpaceMetricsLineGraphProps) => {
    const labelsOrDefault = labels || (timeSpan === 'week' ? ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] : ['Week 1', 'Week 2', 'Week 3', 'Week 4']);
    const valuesOrDefault = values || (timeSpan === 'week'
        ? [[0, 0, 0, 0, 0, 0, 0], [0, 0, 0, 0, 0, 0, 0], [0, 0, 0, 0, 0, 0, 0]]
        : [[0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]]);
    let sampledLabels = [];
    let sampledValues = [];

    if (isMobile && timeSpan === 'month') {
        const every = 3;

        for (let i = 0; i < labelsOrDefault.length; i += every) {
            sampledLabels.push(labelsOrDefault[i]);
        }
        valuesOrDefault.forEach((valueArr, index) => {
            let currentSample = 0;
            for (let i = 0; i < valueArr.length; i += 1) {
                if (i % every === 0) {
                    if (!sampledValues[index]) {
                        sampledValues[index] = [];
                    }
                    sampledValues[index].push(currentSample);
                    currentSample = 0;
                } else {
                    currentSample += valuesOrDefault[index][i];
                }
            }
        });
    } else {
        sampledLabels = labelsOrDefault;
        sampledValues = valuesOrDefault;
    }
    const desktopData = {
        labels: labelsOrDefault,
        series: [
            {
                name: hoverLabels[0],
                data: valuesOrDefault[0],
            },
            {
                name: hoverLabels[1],
                data: valuesOrDefault[1],
            },
            {
                name: hoverLabels[2],
                data: valuesOrDefault[2],
            },
        ],
    };
    const mobileData = {
        labels: sampledLabels,
        series: [
            {
                name: hoverLabels[0],
                data: sampledValues[0],
            },
            {
                name: hoverLabels[1],
                data: sampledValues[1],
            },
            {
                name: hoverLabels[2],
                data: sampledValues[2],
            },
        ],
    };

    const chartistOptions = {
        low: 0,
        showArea: true,
        fullWidth: true,
        // lineSmooth: false,
        chartPadding: {
            top: 15,
            right: 35,
            bottom: 5,
            left: 10,
        },
        axisX: {
            position: 'end',
            showGrid: true,
        },
        axisY: {
            // On the y-axis start means left and end means right
            showGrid: true,
            onlyInteger: true,
            showLabel: true,
            labelInterpolationFnc: (value) => `${value}`,
        },
    };

    // const apexChartSeries = data.series.map((d) => ({
    //     name: 'Impressions',
    //     data: d,
    // }));

    // const apexOptions: any = {
    //     colors: ['#06A77D', '#4D4AE8', '#FD8E7A'],
    //     chart: {
    //         fontFamily: 'Inter',
    //         foreColor: '#4B5563',
    //         toolbar: {
    //             show: true,
    //             offsetX: 0,
    //             offsetY: 0,
    //             tools: {
    //                 download: false,
    //                 selection: false,
    //                 zoom: false,
    //                 zoomin: true,
    //                 zoomout: true,
    //                 pan: true,
    //             },
    //             // export: {
    //             //     csv: {
    //             //         filename: undefined,
    //             //         columnDelimiter: ',',
    //             //         headerCategory: 'category',
    //             //         headerValue: 'value',
    //             //         dateFormatter(timestamp) {
    //             //             return new Date(timestamp).toDateString();
    //             //         },
    //             //     },
    //             // },
    //             autoSelected: 'zoom',
    //         },
    //     },
    //     dataLabels: {
    //         enabled: false,
    //     },
    //     stroke: {
    //         curve: 'smooth',
    //     },
    //     fill: {
    //         type: 'solid',
    //         colors: ['#06A77D'],
    //         opacity: [0.1, 1],
    //     },
    //     // fill: {
    //     //     type:'solid',
    //     //     opacity: [0.35, 1],
    //     //   },
    //     grid: {
    //         show: true,
    //         borderColor: '#f2f2f2',
    //         strokeDashArray: 1,
    //     },
    //     xaxis: {
    //         categories: data.labels,
    //         labels: {
    //             style: {
    //                 fontSize: '12px',
    //                 fontWeight: 500,
    //             },
    //         },
    //         axisBorder: {
    //             color: '#ffffff',
    //         },
    //         axisTicks: {
    //             color: '#ffffff',
    //         },
    //     },
    //     yaxis: {
    //         labels: {
    //             style: {
    //                 colors: ['#4B5563'],
    //                 fontSize: '12px',
    //                 fontWeight: 500,
    //             },
    //         },
    //         // labelInterpolationFnc: (value) => `${value}`,
    //     },
    //     legend: {
    //         show: true,
    //         fontSize: '14px',
    //         fontFamily: 'Inter',
    //         fontWeight: 400,
    //         height: 60,
    //         tooltipHoverFormatter: undefined,
    //         offsetY: 20,
    //         markers: {
    //             width: 14,
    //             height: 14,
    //             strokeWidth: 1,
    //             strokeColor: '#fff',
    //             radius: 50,
    //         },
    //     },
    // };

    const plugins = [
        ChartistTooltip(),
    ];

    if (isMobile) {
        return (
            <Chartist data={mobileData} options={{ ...chartistOptions, plugins }} type="Line" className="ct-major-tenth" />
        );
    }

    return (
        <Chartist
            data={desktopData}
            options={{ ...chartistOptions, height: '300px', plugins }}
            style={{ height: '300px' }}
            type="Line"
            className="ct-double-octave"
        />
    );

    // Uncomment after fixing dependency compilation error
    // return (
    //     <ApexChart
    //         type="area"
    //         height={640}
    //         series={apexChartSeries}
    //         options={apexOptions}
    //     />
    // );
};
