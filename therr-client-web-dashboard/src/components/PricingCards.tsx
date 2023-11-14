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
                <Card className="rounded-0">
                    <Card.Header className="flex-row justify-content-center align-items-center">
                        <h2 className="text-center">
                            Choose the best plan for your business
                        </h2>
                        <p className="text-center">
                            View the checkout page for a <span className="fw-bolder text-underline">30% discount</span> when you pay annually.
                        </p>
                    </Card.Header>
                    <Card.Header className="flex-row justify-content-center align-items-center">
                        <Row className="flex-row justify-content-center align-items-center">
                            <h5 className="text-center text-success text-italic">
                                All packages start with a <span className="fw-bolder text-underline">14 day free trial</span> that can be canceled at any time.
                            </h5>
                        </Row>
                    </Card.Header>
                    <Card.Body>
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
                                                <li><i className="fas fa-check"></i> Ads Orchestrator (Single Origin Marketing)</li>
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
                                                <li className="fw-bolder mb-2"><i className="fas fa-star"></i> All Basic Plan Features</li>
                                                <li><i className="fas fa-check"></i> Ads Orchestrator (Single Origin Marketing + AI)</li>
                                                <li><i className="fas fa-check"></i> Customer & Micro-influencer incentives (for reviews, shout-outs, promos, etc.)</li>
                                                <li><i className="fas fa-check"></i> Personalized Influencer Pairing</li>
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
                                                <li className="fw-bolder mb-2"><i className="fas fa-star"></i> All Basic/Advanced Plan Features</li>
                                                <li><i className="fas fa-check"></i> Ads Orchestrator (Single Origin Marketing + Advance AI)</li>
                                                <li><i className="fas fa-check"></i> Prioritized & Personalized Influencer Pairing</li>
                                                <li><i className="fas fa-check"></i> Point-of-purchase incentives for customers & influencers</li>
                                                <li><i className="fas fa-check"></i> Curated Business Marketing on Therr Blog & Associated Social Media Accounts</li>
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
