import React from 'react';
import {
    Button, ButtonGroup, Card, Col, Row,
} from 'react-bootstrap';
import {
    faChartLine, faChevronLeft, faChevronRight, faStar,
} from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { IUserState } from 'therr-react/types';
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
    onChangeTimeSpan: any;
    isLoading: boolean;
    isSuperAdmin: boolean;
    user: IUserState;
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
    onChangeTimeSpan,
    isSuperAdmin,
    user,
}: OverviewOfSpaceMetrics) => {
    if (isLoading) {
        return (
            <p className="text-center mt-1">Loading...</p>
        );
    }

    const spaceTitle = `${spacesInView[currentSpaceIndex] ? spacesInView[currentSpaceIndex].notificationMsg : 'No Data'}`;

    return (
        <>
            <div className="d-flex justify-content-around justify-content-md-between flex-wrap flex-md-nowrap align-items-center py-4">
                {
                    isSuperAdmin && <AdminManageSpacesMenu className="mb-2 mb-md-0" navigateHandler={navigateHandler} />
                }
                {
                    !isSuperAdmin && <ManageSpacesMenu className="mb-2 mb-md-0" user={user} navigateHandler={navigateHandler} />
                }
                <h3 className="fw-normal mb-2 d-none d-xl-block" style={{ maxWidth: '30rem' }}>
                    <span className="fw-bolder">{spaceTitle}</span>
                </h3>
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
            <Card className="bg-white shadow-sm d-xl-none mb-3 mb-xl-4">
                <Card.Header className="d-flex flex-row align-items-center flex-0">
                    <h3 className="fw-bold text-center">
                        Location: <span className="fw-bolder">{spaceTitle}</span>
                    </h3>
                </Card.Header>
            </Card>
            <Row className="justify-content-md-center">
                <Col xs={12} xl={8} xxl={9} className="mb-3 mb-xl-4 d-none d-sm-block">
                    <SpaceMetricsDisplay
                        isMobile={false}
                        title={spaceTitle}
                        labels={overviewGraphLabels}
                        values={overviewGraphValues}
                        percentage={percentageChange}
                        onChangeTimeSpan={onChangeTimeSpan}
                        spanOfTime={spanOfTime}
                    />
                </Col>
                <Col xs={12} xl={8} xxl={9} className="mb-3 mb-xl-4 d-sm-none">
                    <SpaceMetricsDisplay
                        isMobile={true}
                        title={spaceTitle}
                        labels={overviewGraphLabels}
                        values={overviewGraphValues}
                        percentage={percentageChange}
                        onChangeTimeSpan={onChangeTimeSpan}
                        spanOfTime={spanOfTime}
                    />
                </Col>
                <Col xs={12} xl={4} xxl={3} className="mb-3 mb-xl-4">
                    <Row className="justify-content-md-center">
                        <Col xs={12} sm={6} xl={12} className="mb-3 mb-xl-4">
                            <StarRatingDisplay
                                averageRating={averageRating}
                                totalRating={totalRating}
                                category="Space Rating"
                                title={`Avg. Rating: ${averageRating || 'N/A'}`}
                                icon={faStar}
                                iconColor="shape-secondary"
                            />
                        </Col>
                        <Col xs={12} sm={6} xl={12} className="mb-3 mb-xl-4">
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
