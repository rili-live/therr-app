import React from 'react';
import {
    Button, ButtonGroup, Col, Row,
} from 'react-bootstrap';
import {
    faChevronLeft, faChevronRight,
} from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { ISpace } from '../../../types';
// import AdminManageCampaignsMenu from '../../../components/AdminManageCampaignsMenu';
// import ManageCampaignsMenu from '../../../components/ManageCampaignsMenu';

interface OverviewOfCampaignMetrics {
    navigateHandler: any;
    onPrevCampaignClick: any;
    onNextCampaignClick: any;
    currentCampaignIndex: number;
    campaignsInView: ISpace[]; // TODO: Move to Redux
    spanOfTime: 'week' | 'month';
    fetchCampaignMetrics: any;
    isLoading: boolean;
    isSuperAdmin: boolean;
}

const OverviewOfCampaignMetrics = ({
    navigateHandler,
    onPrevCampaignClick,
    onNextCampaignClick,
    currentCampaignIndex,
    isLoading,
    campaignsInView,
    spanOfTime,
    isSuperAdmin,
}: OverviewOfCampaignMetrics) => {
    if (isLoading) {
        return (
            <p className="text-center mt-1">Loading...</p>
        );
    }

    return (
        <>
            <div className="d-flex justify-content-around justify-content-md-between flex-wrap flex-md-nowrap align-items-center py-4">
                {/* {
                    isSuperAdmin && <AdminManageCampaignsMenu className="mb-2 mb-md-0" navigateHandler={navigateHandler} />
                }
                {
                    !isSuperAdmin && <ManageCampaignsMenu className="mb-2 mb-md-0" navigateHandler={navigateHandler} />
                } */}
                <ButtonGroup className="mb-2 mb-md-0">
                    {
                        currentCampaignIndex !== 0
                            && <Button onClick={onPrevCampaignClick} variant="outline-primary" size="sm">
                                <FontAwesomeIcon icon={faChevronLeft} className="me-2" /> Prev. Campaign
                            </Button>
                    }
                    {
                        currentCampaignIndex < campaignsInView.length - 1
                            && <Button onClick={onNextCampaignClick} variant="outline-primary" size="sm">
                                Next Campaign <FontAwesomeIcon icon={faChevronRight} className="me-2" />
                            </Button>
                    }
                </ButtonGroup>
            </div>
            <Row className="justify-content-md-center">Campaigns Metrics Placeholder...</Row>
        </>
    );
};

export default OverviewOfCampaignMetrics;
