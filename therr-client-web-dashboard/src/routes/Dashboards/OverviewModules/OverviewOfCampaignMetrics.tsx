import React from 'react';
import {
    Button, ButtonGroup, Card, Col, Row,
} from 'react-bootstrap';
import {
    faChevronLeft, faChevronRight,
} from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { IUserState } from 'therr-react/types';
import { ICampaign } from '../../../types';
// import AdminManageCampaignsMenu from '../../../components/AdminManageCampaignsMenu';
import ManageCampaignsMenu from '../../../components/ManageCampaignsMenu';
import CampaignInsights from '../../../components/charts/CampaignInsights';

interface OverviewOfCampaignMetrics {
    navigateHandler: any;
    onPrevCampaignClick: any;
    onNextCampaignClick: any;
    currentCampaignIndex: number;
    campaignsInView: ICampaign[]; // TODO: Move to Redux
    spanOfTime: 'week' | 'month';
    fetchCampaignInsights: any;
    isLoading: boolean;
    isSuperAdmin: boolean;
    performanceSummary: {
        [key: string]: any;
    }
    user: IUserState;
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
    performanceSummary,
    user,
}: OverviewOfCampaignMetrics) => {
    if (isLoading) {
        return (
            <p className="text-center mt-1">Loading...</p>
        );
    }

    const campaign = campaignsInView[currentCampaignIndex];

    const campaignTitle = `${campaign ? campaign.title : 'No Data'}`;

    return (
        <>
            <div className="d-flex justify-content-around justify-content-md-between flex-wrap flex-md-nowrap align-items-center py-4">
                {
                    isSuperAdmin && <ManageCampaignsMenu user={user} className="mb-2 mb-md-0" navigateHandler={navigateHandler} />
                }
                {
                    !isSuperAdmin && <ManageCampaignsMenu user={user} className="mb-2 mb-md-0" navigateHandler={navigateHandler} />
                }
                <h3 className="fw-normal mb-2 d-none d-xl-block" style={{ maxWidth: '30rem' }}>
                    <span className="fw-bolder">{campaignTitle}</span>
                </h3>
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
            <Card className="bg-white shadow-sm d-xl-none mb-3 mb-xl-4">
                <Card.Header className="d-flex flex-row align-items-center flex-0">
                    <h3 className="fw-bold text-center">
                        Campaign: <span className="fw-bolder">{campaignTitle}</span>
                    </h3>
                </Card.Header>
            </Card>
            <CampaignInsights
                campaign={campaign}
                performanceSummary={performanceSummary}
            />
        </>
    );
};

export default OverviewOfCampaignMetrics;
