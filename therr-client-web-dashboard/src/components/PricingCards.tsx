/* eslint-disable max-len */
import React from 'react';
import ReactGA from 'react-ga4';
import {
    Col,
    Row,
    Card,
    Button,
} from 'react-bootstrap';
import {
    FontAwesomeIcon,
} from '@fortawesome/react-fontawesome';
import {
    faRocket,
} from '@fortawesome/free-solid-svg-icons';

interface IPricingCardsProps {
    eventSource: string;
}

const PricingCards = ({
    eventSource,
}: IPricingCardsProps) => {
    const onClickUpgrade = (plan: string) => {
        ReactGA.event('clicked_upgrade_btn', {
            source: eventSource,
            plan,
        });
    };
    const getOnClickUpgrade = (plan: string) => () => onClickUpgrade(plan);

    return (
        <Row className="d-flex justify-content-around align-items-center py-4">
            <Col xs={12} xl={12} xxl={10}>
                <Card>
                    <Card.Body>
                        <Row className="flex-row justify-content-center align-items-center">
                            <h3 className="text-center pb-4">
                                Upgrade to the Basic, Advanced, or Pro plan to activate these additional features.
                            </h3>
                        </Row>
                        <Row className="flex-row justify-content-center align-items-center">
                            <Col xs={12} xl={6} xxl={4} className="text-center">
                                <Row className="justify-content-center align-items-center mx-2 mb-4">
                                    <Card className="bg-basic-card pricing-card-basic">
                                        <Card.Body>
                                            <h3 className="text-white">Basic Marketing Plan</h3>
                                            <h6 className="text-white">Benefit from our basic local business marketing support package along with metrics from current and prospective customers.</h6>
                                            <hr />
                                            <Button
                                                onClick={getOnClickUpgrade('basic')}
                                                href={'https://buy.stripe.com/3cs7tkcsZ6z4fTy7ss'}
                                                target="_blank"
                                                variant="primary"
                                                className="text-white"
                                            >
                                                <FontAwesomeIcon icon={faRocket} className="me-1" />
                                                Upgrade to Basic ($14.99)
                                            </Button>
                                            <hr />
                                            <ul className="list-unstyled text-white text-left">
                                                <li><i className="fas fa-check"></i> Business space prioritized on mobile app</li>
                                                <li><i className="fas fa-check"></i> Additional customer metrics</li>
                                                <li><i className="fas fa-check"></i> 24/7 Tech Support</li>
                                            </ul>
                                        </Card.Body>
                                    </Card>
                                </Row>
                            </Col>
                            <Col xs={12} xl={6} xxl={4} className="text-center">
                                <Row className="justify-content-center align-items-center mx-2 mb-4">
                                    <Card className="bg-advanced-card pricing-card-advanced">
                                        <Card.Body>
                                            <h3 className="text-white">Advanced Marketing Plan</h3>
                                            <h6 className="text-white">Benefit from our premium local business marketing support package along with advanced metrics from current and prospective customers.</h6>
                                            <hr />
                                            <Button
                                                onClick={getOnClickUpgrade('advanced')}
                                                href={'https://buy.stripe.com/aEUdRI78F0aGePu6op'}
                                                target="_blank"
                                                variant="primary"
                                                className="text-white"
                                            >
                                                <FontAwesomeIcon icon={faRocket} className="me-1" />
                                                Upgrade to Advanced ($34.99)
                                            </Button>
                                            <hr />
                                            <ul className="list-unstyled text-white text-left">
                                                <li><i className="fas fa-check"></i> Business space prioritized on mobile app</li>
                                                <li><i className="fas fa-check"></i> Enhanced customer metrics</li>
                                                <li><i className="fas fa-check"></i> 24/7 Tech Support</li>
                                                <li><i className="fas fa-check"></i> Automated & Configurable Marketing Campaigns (S.O.M.)</li>
                                                <li><i className="fas fa-check"></i> Customer & Micro-influencer incentives (for reviews, shout-outs, promos, etc.)</li>
                                            </ul>
                                        </Card.Body>
                                    </Card>
                                </Row>
                            </Col>
                            <Col xs={12} xl={6} xxl={4} className="text-center">
                                <Row className="justify-content-center align-items-center mx-2 mb-4">
                                    <Card className="bg-pro-card pricing-card-pro">
                                        <Card.Body>
                                            <h3 className="text-white">Pro Marketing Plan</h3>
                                            <h6 className="text-white">Benefit from our professional local business marketing support package along with high fidelity metrics from current and prospective customers.</h6>
                                            <hr />
                                            <Button
                                                onClick={getOnClickUpgrade('pro')}
                                                href={'https://buy.stripe.com/8wM14W64Bg9E36M146'}
                                                target="_blank"
                                                variant="primary"
                                                className="text-white"
                                            >
                                                <FontAwesomeIcon icon={faRocket} className="me-1" />
                                                Upgrade to Pro ($99.99)
                                            </Button>
                                            <hr />
                                            <ul className="list-unstyled text-white text-left">
                                                <li><i className="fas fa-check"></i> Business space prioritized on mobile app</li>
                                                <li><i className="fas fa-check"></i> Additional customer metrics</li>
                                                <li><i className="fas fa-check"></i> 24/7 Tech Support</li>
                                                <li><i className="fas fa-check"></i> Automated & Configurable Marketing Campaigns (S.O.M.)</li>
                                                <li><i className="fas fa-check"></i> Customer & influencer incentives (for reviews, shout-outs, promos, etc.)</li>
                                                <li><i className="fas fa-check"></i> Point-of-purchase incentives for customers & influencers</li>
                                                <li><i className="fas fa-check"></i> Influencer marketing on Instagram/Twitter/etc.</li>
                                                <li><i className="fas fa-check"></i> Curated Facebook, Twitter, & Google Ads campaign</li>
                                            </ul>
                                        </Card.Body>
                                    </Card>
                                </Row>
                            </Col>
                        </Row>
                    </Card.Body>
                </Card>
            </Col>
        </Row>
    );
};

export default PricingCards;
