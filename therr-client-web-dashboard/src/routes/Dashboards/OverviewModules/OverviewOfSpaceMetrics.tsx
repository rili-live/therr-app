import React from 'react';
import {
    Button, ButtonGroup, Col, Row,
} from 'react-bootstrap';
import {
    faChartLine, faChevronLeft, faChevronRight, faStar,
} from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { SpaceMetricsDisplay } from '../../../components/widgets/SpaceMetricsDisplay';
import { ISpace } from '../../../types';
import StarRatingDisplay from '../../../components/widgets/StarRatingDisplay';
import { CounterWidget } from '../../../components/Widgets';
import AdminManageSpacesMenu from '../../../components/AdminManageSpacesMenu';
import ManageSpacesMenu from '../../../components/ManageSpacesMenu';

interface OverviewOfSpaceMetrics {
    navigateHandler: any;
    onPrevSpaceClick: any;
    onNextSpaceClick: any;
    currentSpaceIndex: number;
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
    isSuperAdmin: boolean;
}

const OverviewOfSpaceMetrics = ({
    navigateHandler,
    onPrevSpaceClick,
    onNextSpaceClick,
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
    isSuperAdmin,
}: OverviewOfSpaceMetrics) => {
    if (isLoading) {
        return (
            <p className="text-center mt-1">Loading...</p>
        );
    }

    return (
        <>
            <div className="d-flex justify-content-around justify-content-md-between flex-wrap flex-md-nowrap align-items-center py-4">
                {
                    isSuperAdmin && <AdminManageSpacesMenu className="mb-2 mb-md-0" navigateHandler={navigateHandler} />
                }
                {
                    !isSuperAdmin && <ManageSpacesMenu className="mb-2 mb-md-0" navigateHandler={navigateHandler} />
                }
                <ButtonGroup className="mb-2 mb-md-0">
                    {
                        currentSpaceIndex !== 0
                            && <Button onClick={onPrevSpaceClick} variant="outline-primary" size="sm">
                                <FontAwesomeIcon icon={faChevronLeft} className="me-2" /> Prev. Space
                            </Button>
                    }
                    {
                        currentSpaceIndex < spacesInView.length - 1
                            && <Button onClick={onNextSpaceClick} variant="outline-primary" size="sm">
                                Next Space <FontAwesomeIcon icon={faChevronRight} className="me-2" />
                            </Button>
                    }
                </ButtonGroup>
            </div>
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
        </>
    );
};

export default OverviewOfSpaceMetrics;