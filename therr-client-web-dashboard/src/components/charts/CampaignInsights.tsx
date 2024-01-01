import React from 'react';
import {
    Col,
    Row,
    Card,
} from 'react-bootstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faFacebook, faInstagram } from '@fortawesome/free-brands-svg-icons';
import {
    OAuthIntegrationProviders,
} from 'therr-js-utilities/constants';
import { ICampaign } from '../../types';

interface ICampaignInsightsProps {
    campaign: ICampaign;
    performanceSummary: {
        [key: string]: any;
    };
}

const CampaignInsights = ({
    campaign,
    performanceSummary,
}: ICampaignInsightsProps) => {
    const isTherrSelected = campaign?.integrationTargets?.includes(OAuthIntegrationProviders.THERR);
    const isGoogleSelected = campaign?.integrationTargets?.includes(OAuthIntegrationProviders.GOOGLE);
    const isFacebookSelected = campaign?.integrationTargets?.includes(OAuthIntegrationProviders.FACEBOOK);
    const isInstagramSelected = campaign?.integrationTargets?.includes(OAuthIntegrationProviders.INSTAGRAM);
    const isTwitterSelected = campaign?.integrationTargets?.includes(OAuthIntegrationProviders.TWITTER);
    const isLinkedInSelected = campaign?.integrationTargets?.includes(OAuthIntegrationProviders.LINKEDIN);

    if (!isTherrSelected && !isGoogleSelected && !isFacebookSelected && !isInstagramSelected && !isTwitterSelected && !isLinkedInSelected) {
        return (
            <h3 className="text-center mt-5">
                <span className="fw-bolder">No Insights Available:</span> Campaign has either not run yet or is missing integration targets
            </h3>
        );
    }

    return (
        <Row className="d-flex justify-content-center align-items-center">
            {
                isTherrSelected
                && <Col sm={12} lg={6} xl={4} xxl={3} className="text-center mt-5">
                    <Card className="bg-white shadow-sm rounded-0">
                        <Card.Header>
                            <h2>
                                <Card.Img
                                    src={'/assets/img/therr-logo-green.svg'}
                                    alt="Therr Ads"
                                    className={'text-therr mx-2 w-auto'}
                                    height={32}
                                    width={32}
                                />
                                Therr
                            </h2>
                        </Card.Header>
                        <Card.Body>
                            <h4 className="fw-normal">Clicks: <span className="fw-bolder">
                                {performanceSummary[OAuthIntegrationProviders.THERR]?.clicks || 'N/A'}
                            </span></h4>
                            <h4 className="fw-normal">
                                Unique Clicks: <span className="fw-bolder">
                                    {performanceSummary[OAuthIntegrationProviders.THERR]?.unique_clicks || 'N/A'}
                                </span>
                            </h4>
                            <h4 className="fw-normal">CPM: <span className="fw-bolder">
                                {performanceSummary[OAuthIntegrationProviders.THERR]?.cpm || 'N/A'}
                            </span></h4>
                            <h4 className="fw-normal">Impressions: <span className="fw-bolder">
                                {performanceSummary[OAuthIntegrationProviders.THERR]?.impressions || 'N/A'}
                            </span></h4>
                            <h4 className="fw-normal">Reach: <span className="fw-bolder">
                                {performanceSummary[OAuthIntegrationProviders.THERR]?.reach || 'N/A'}
                            </span></h4>
                            <h4 className="fw-normal">Spend: <span className="fw-bolder">
                                {performanceSummary[OAuthIntegrationProviders.THERR]?.spend || 'N/A'}
                            </span></h4>
                        </Card.Body>
                    </Card>
                </Col>

            }
            {
                (isFacebookSelected || isInstagramSelected)
                && <Col sm={12} lg={6} xl={4} xxl={3} className="text-center mt-5">
                    <Card className="bg-white shadow-sm rounded-0">
                        <Card.Header>
                            <h2>
                                <FontAwesomeIcon
                                    icon={faFacebook}
                                    className={'text-facebook mx-2'}
                                    size="1x"
                                />
                                Facebook / IG
                                <FontAwesomeIcon
                                    icon={faInstagram}
                                    className={'text-instagram mx-2'}
                                    size="1x"
                                />
                            </h2>
                        </Card.Header>
                        <Card.Body>
                            <h4 className="fw-normal">Clicks: <span className="fw-bolder">
                                {performanceSummary[OAuthIntegrationProviders.FACEBOOK]?.clicks || 'N/A'}
                            </span></h4>
                            <h4 className="fw-normal">
                                Unique Clicks: <span className="fw-bolder">
                                    {performanceSummary[OAuthIntegrationProviders.FACEBOOK]?.unique_clicks || 'N/A'}
                                </span>
                            </h4>
                            <h4 className="fw-normal">CPM: <span className="fw-bolder">
                                {performanceSummary[OAuthIntegrationProviders.FACEBOOK]?.cpm || 'N/A'}
                            </span></h4>
                            <h4 className="fw-normal">Impressions: <span className="fw-bolder">
                                {performanceSummary[OAuthIntegrationProviders.FACEBOOK]?.impressions || 'N/A'}
                            </span></h4>
                            <h4 className="fw-normal">Reach: <span className="fw-bolder">
                                {performanceSummary[OAuthIntegrationProviders.FACEBOOK]?.reach || 'N/A'}
                            </span></h4>
                            <h4 className="fw-normal">Spend: <span className="fw-bolder">
                                {performanceSummary[OAuthIntegrationProviders.FACEBOOK]?.spend || 'N/A'}
                            </span></h4>
                        </Card.Body>
                    </Card>
                </Col>
            }
        </Row>
    );
};

export default CampaignInsights;
