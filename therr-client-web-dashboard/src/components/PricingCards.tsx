/* eslint-disable max-len */
import React, { useState } from 'react';
import ReactGA from 'react-ga4';
import {
    Col,
    Row,
    Card,
    Button,
    FormCheck,
} from 'react-bootstrap';
import {
    FontAwesomeIcon,
} from '@fortawesome/react-fontawesome';
import CountUp from 'react-countup';
import {
    faRocket,
} from '@fortawesome/free-solid-svg-icons';

interface IPricingCardsProps {
    eventSource: string;
}

const PricingCards = ({
    eventSource,
}: IPricingCardsProps) => {
    const [isPriceMonthly, setIsPriceMonthly] = useState(true);
    const priceType = isPriceMonthly ? 'monthly' : 'annual';
    const onClickUpgrade = (plan: string) => {
        ReactGA.event('clicked_upgrade_btn', {
            source: eventSource,
            plan,
        });
    };
    const getOnClickUpgrade = (plan: string) => () => onClickUpgrade(plan);
    const togglePriceType = () => {
        setIsPriceMonthly(!isPriceMonthly);
    };

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
                    <Col xs={12} className="d-flex align-items-center justify-content-center pt-2 pb-1">
                        <h5 className="fw-normal me-4 mt-2">
                            Monthly
                        </h5>
                        <FormCheck type="switch">
                            <FormCheck.Input type="checkbox" id="billingSwitch" value={isPriceMonthly.toString()} onChange={togglePriceType} />
                            <FormCheck.Label htmlFor="billingSwitch" />
                        </FormCheck>
                        <h5 className="fw-normal ms-1 mt-2">
                            Annual
                        </h5>
                    </Col>
                    <Card.Body>
                        <Row className="flex-row justify-content-center align-items-center">
                            <Col xs={12} xl={6} xxl={4} className="text-center">
                                <Row className="justify-content-center align-items-center mx-2 mb-4">
                                    <Card className="bg-basic-card pricing-card-basic">
                                        <Card.Header className="border-gray-100 py-4 px-4">
                                            <div className="d-flex mb-1 text-white">
                                                <h5 className="mb-0">$</h5>
                                                <span className={'price display-2 mb-0'}>
                                                    <CountUp start={isPriceMonthly ? 10 : 15} end={isPriceMonthly ? 15 : 10} duration={1} />
                                                </span>
                                                <h6 className="fw-normal align-self-end">/ month</h6>
                                            </div>
                                            <h4 className="mb-1 text-white text-left">Basic Marketing Plan</h4>
                                        </Card.Header>
                                        <Card.Body>
                                            <h6 className="text-white pb-2">Benefit from our basic local business marketing support package along with metrics from current and prospective customers.</h6>
                                            <ul className="list-unstyled text-white text-left">
                                                <li><i className="fas fa-check"></i> Business space prioritized on mobile app</li>
                                                <li><i className="fas fa-check"></i> Ads Orchestrator (Single Origin Marketing)</li>
                                                <li><i className="fas fa-check"></i> Additional customer metrics</li>
                                                <li><i className="fas fa-check"></i> 24/7 Tech Support</li>
                                            </ul>
                                        </Card.Body>
                                        <Card.Footer className="border-gray-100 py-4 px-4">
                                            <Button
                                                onClick={getOnClickUpgrade('basic')}
                                                href={'https://buy.stripe.com/3cs7tkcsZ6z4fTy7ss'}
                                                target="_blank"
                                                variant="primary"
                                                className="text-white w-100"
                                            >
                                                <FontAwesomeIcon icon={faRocket} className="me-1" />
                                                Upgrade to Basic ({isPriceMonthly ? '$14.99/month' : '$125/year'})
                                            </Button>
                                        </Card.Footer>
                                    </Card>
                                </Row>
                            </Col>
                            <Col xs={12} xl={6} xxl={4} className="text-center">
                                <Row className="justify-content-center align-items-center mx-2 mb-4">
                                    <Card className="bg-advanced-card pricing-card-advanced">
                                        <Card.Header className="border-gray-100 py-4 px-4">
                                            <div className="d-flex mb-1 text-white">
                                                <h5 className="mb-0">$</h5>
                                                <span className={'price display-2 mb-0'}>
                                                    <CountUp start={isPriceMonthly ? 24 : 35} end={isPriceMonthly ? 35 : 24} duration={1} />
                                                </span>
                                                <h6 className="fw-normal align-self-end">/ month</h6>
                                            </div>
                                            <h4 className="mb-1 text-white text-left">Advanced Marketing Plan</h4>
                                        </Card.Header>
                                        <Card.Body>
                                            <h6 className="text-white pb-2">Benefit from our premium local business marketing support package along with advanced metrics from current and prospective customers.</h6>
                                            <ul className="list-unstyled text-white text-left">
                                                <li className="fw-bolder mb-2"><i className="fas fa-star"></i> All Basic Plan Features</li>
                                                <li><i className="fas fa-check"></i> Ads Orchestrator (Single Origin Marketing + AI)</li>
                                                <li><i className="fas fa-check"></i> Customer & Micro-influencer incentives (for reviews, shout-outs, promos, etc.)</li>
                                                <li><i className="fas fa-check"></i> Personalized Influencer Pairing</li>
                                            </ul>
                                        </Card.Body>
                                        <Card.Footer className="border-gray-100 py-4 px-4">
                                            <Button
                                                onClick={getOnClickUpgrade('advanced')}
                                                href={'https://buy.stripe.com/aEUdRI78F0aGePu6op'}
                                                target="_blank"
                                                variant="primary"
                                                className="text-white w-100"
                                            >
                                                <FontAwesomeIcon icon={faRocket} className="me-1" />
                                                Upgrade to Advanced ({isPriceMonthly ? '$34.99/month' : '$295/year'})
                                            </Button>
                                        </Card.Footer>
                                    </Card>
                                </Row>
                            </Col>
                            <Col xs={12} xl={6} xxl={4} className="text-center">
                                <Row className="justify-content-center align-items-center mx-2 mb-4">
                                    <Card className="bg-pro-card pricing-card-pro">
                                        <Card.Header className="border-gray-100 py-4 px-4">
                                            <div className="d-flex mb-1 text-white">
                                                <h5 className="mb-0">$</h5>
                                                <span className={'price display-2 mb-0'}>
                                                    <CountUp start={isPriceMonthly ? 69 : 99} end={isPriceMonthly ? 99 : 69} duration={1} />
                                                </span>
                                                <h6 className="fw-normal align-self-end">/ month</h6>
                                            </div>
                                            <h4 className="mb-1 text-white text-left">Pro Marketing Plan</h4>
                                        </Card.Header>
                                        <Card.Body>
                                            <h6 className="text-white pb-2">Benefit from our professional local business marketing support package along with high fidelity metrics from current and prospective customers.</h6>
                                            <ul className="list-unstyled text-white text-left">
                                                <li className="fw-bolder mb-2"><i className="fas fa-star"></i> All Basic/Advanced Plan Features</li>
                                                <li><i className="fas fa-check"></i> Ads Orchestrator (Single Origin Marketing + Advance AI)</li>
                                                <li><i className="fas fa-check"></i> Prioritized & Personalized Influencer Pairing</li>
                                                <li><i className="fas fa-check"></i> Point-of-purchase incentives for customers & influencers</li>
                                                <li><i className="fas fa-check"></i> Curated Business Marketing on Therr Blog & Associated Social Media Accounts</li>
                                            </ul>
                                        </Card.Body>
                                        <Card.Footer className="border-gray-100 py-4 px-4">
                                            <Button
                                                onClick={getOnClickUpgrade('pro')}
                                                href={'https://buy.stripe.com/8wM14W64Bg9E36M146'}
                                                target="_blank"
                                                variant="primary"
                                                className="text-white w-100"
                                            >
                                                <FontAwesomeIcon icon={faRocket} className="me-1" />
                                                Upgrade to Pro ({isPriceMonthly ? '$99.99/month' : '$835/year'})
                                            </Button>
                                        </Card.Footer>
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
