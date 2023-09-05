import React from 'react';
import { Col, Row } from 'react-bootstrap';
import { faChartLine, faStar } from '@fortawesome/free-solid-svg-icons';
import { SpaceMetricsDisplay } from '../../../components/widgets/SpaceMetricsDisplay';
import { ISpace } from '../../../types';
import StarRatingDisplay from '../../../components/widgets/StarRatingDisplay';
import { CounterWidget } from '../../../components/Widgets';

interface OverviewOfSpaceMetrics {
    currentSpaceIndex: number;
    latitude?: number;
    longitude?: number;
    overviewGraphLabels: string[] | undefined;
    overviewGraphValues: number[][] | undefined;
    percentageChange: number;
    avgImpressions: number;
    spacesInView: ISpace[]; // TODO: Move to Redux
    spanOfTime: 'week' | 'month';
    averageRating: number;
    totalRating: number;
    fetchSpaceMetrics: any;
    isLoading: boolean;
}

const OverviewOfSpaceMetrics = ({
    currentSpaceIndex,
    isLoading,
    overviewGraphLabels,
    overviewGraphValues,
    percentageChange,
    avgImpressions,
    spacesInView,
    spanOfTime,
    averageRating,
    totalRating,
    fetchSpaceMetrics,
}: OverviewOfSpaceMetrics) => {
    if (isLoading) {
        return (
            <p className="text-center mt-1">Loading...</p>
        );
    }

    return (
        <Row className="justify-content-md-center">
            <Col xs={12} lg={9} className="mb-4 d-none d-sm-block">
                <SpaceMetricsDisplay
                    isMobile={false}
                    title={`${spacesInView[currentSpaceIndex] ? spacesInView[currentSpaceIndex].notificationMsg : 'No Data'}`}
                    labels={overviewGraphLabels}
                    values={overviewGraphValues}
                    percentage={percentageChange}
                    fetchSpaceMetrics={fetchSpaceMetrics}
                />
            </Col>
            <Col xs={12} lg={9} className="mb-4 d-sm-none">
                <SpaceMetricsDisplay
                    isMobile={true}
                    title={`${spacesInView[currentSpaceIndex] ? spacesInView[currentSpaceIndex].notificationMsg : 'No Data'}`}
                    labels={overviewGraphLabels}
                    values={overviewGraphValues}
                    percentage={percentageChange}
                    fetchSpaceMetrics={fetchSpaceMetrics}
                />
            </Col>
            <Col xs={12} lg={3} className="mb-4">
                <Row className="justify-content-md-center">
                    <Col xs={12} className="mb-4">
                        <StarRatingDisplay
                            averageRating={averageRating}
                            totalRating={totalRating}
                            category="Space Rating"
                            title={`Avg. Rating: ${averageRating || 'N/A'}`}
                            icon={faStar}
                            iconColor="shape-secondary"
                        />
                    </Col>
                    <Col xs={12} className="mb-4">
                        <CounterWidget
                            period={spanOfTime}
                            percentage={percentageChange}
                            category="Daily Impressions"
                            title={`~${avgImpressions} per day`}
                            icon={faChartLine}
                            iconColor="shape-secondary"
                        />
                    </Col>
                </Row>
            </Col>
        </Row>
    );
};

export default OverviewOfSpaceMetrics;
