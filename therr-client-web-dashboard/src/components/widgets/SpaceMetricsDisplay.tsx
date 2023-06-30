import React, { useState } from 'react';
import {
    FontAwesomeIcon,
} from '@fortawesome/react-fontawesome';
import {
    faAngleDown,
    faAngleUp,
} from '@fortawesome/free-solid-svg-icons';
import {
    Card,
    Button,
} from '@themesberg/react-bootstrap';
import { SpaceMetricsLineGraph } from '../charts/SpaceMetricsLineGraph';

// TODO: Display label for each type of metric
const MetricsSummary = ({
    title,
    metricLabel,
    totalCount,
    previousTimespanLabel,
    percentage,
    percentageIcon,
    percentageColor,
}: any) => (
    <>
        <h5 className="fw-normal mb-2">
            {title}
        </h5>
        {
            totalCount != null
            && <>
                <h3>{totalCount} {metricLabel}</h3>
                <small className="fw-bold mt-2">
                    <span className="me-2">{previousTimespanLabel}</span>
                    <FontAwesomeIcon icon={percentageIcon} className={`${percentageColor} me-1`} />
                    <span className={percentageColor}>
                        {percentage}%
                    </span>
                </small>
            </>
        }
    </>
);

const ChartActions = ({
    onTimeSpanChange,
    timeSpan,
}: any) => (
    <div className="d-flex ms-auto">
        <Button
            variant={timeSpan === 'month' ? 'primary' : 'secondary'}
            size="sm"
            className="me-2"
            onClick={() => onTimeSpanChange('month')}
        >
            Month
        </Button>
        <Button
            variant={timeSpan === 'week' ? 'primary' : 'secondary'}
            size="sm"
            className="me-3"
            onClick={() => onTimeSpanChange('week')}
        >
            Week
        </Button>
    </div>
);

// This should also abstract SpaceMetricsDisplay so we don't need to maintain 2 separate components
export const SpaceMetricsDisplay = (props: any) => {
    const {
        title,
        percentage,
        fetchSpaceMetrics,
        isMobile,
        labels,
        values,
    } = props;
    const percentageIcon = percentage < 0 ? faAngleDown : faAngleUp;
    const percentageColor = percentage < 0 ? 'text-danger' : 'text-success';
    const [timeSpan, setTimeSpan] = useState('week');
    const onTimeSpanChange = (spanOfTime: 'week' | 'month') => {
        setTimeSpan(spanOfTime);
        if (spanOfTime !== timeSpan) {
            fetchSpaceMetrics(spanOfTime);
        }
    };
    // TODO: Sum each individual metric
    const totalMetricsCount = values ? values.reduce((acc, cur) => cur.reduce((a, c) => a + c, 0) + acc, 0) : 0;

    if (isMobile) {
        return (
            <Card className="bg-white shadow-sm">
                <Card.Header className="d-md-flex flex-row align-items-center flex-0">
                    <div className="d-block mb-3 mb-md-0">
                        <MetricsSummary
                            title={title}
                            totalCount={totalMetricsCount}
                            metricLabel="Visits/Prospects/Impressions"
                            previousTimespanLabel={timeSpan === 'week' ? 'Previous Week' : 'Previous Month'}
                            percentage={percentage}
                            percentageIcon={percentageIcon}
                            percentageColor={percentageColor}
                        />
                    </div>
                    <ChartActions
                        onTimeSpanChange={onTimeSpanChange}
                        timeSpan={timeSpan}
                    />
                </Card.Header>
                <Card.Body className="p-2">
                    <SpaceMetricsLineGraph isMobile={true} timeSpan={timeSpan} labels={labels} values={values} />
                </Card.Body>
            </Card>
        );
    }

    return (
        <Card className="bg-white shadow-sm">
            <Card.Header className="d-flex flex-row align-items-center flex-0">
                <div className="d-block">
                    <MetricsSummary
                        title={title}
                        totalCount={totalMetricsCount}
                        metricLabel="Visits/Prospects/Impressions"
                        previousTimespanLabel={timeSpan === 'week' ? 'Previous Week' : 'Previous Month'}
                        percentage={percentage}
                        percentageIcon={percentageIcon}
                        percentageColor={percentageColor}
                    />
                </div>
                <ChartActions
                    onTimeSpanChange={onTimeSpanChange}
                    timeSpan={timeSpan}
                />
            </Card.Header>
            <Card.Body className="p-2">
                <SpaceMetricsLineGraph isMobile={false} timeSpan={timeSpan} labels={labels} values={values} />
            </Card.Body>
        </Card>
    );
};
