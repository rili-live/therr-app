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
            <Col xs={12} xl={10} xxl={8}>
                <Card>
                    <Card.Body>
                        <Row className="flex-row justify-content-center align-items-center">
                            <h3 className="text-center pb-4">
                                Upgrade to the Basic, Advanced, or Pro plan to activate these additional features.
                            </h3>
                        </Row>
                        <Row className="flex-row justify-content-center align-items-center">
                            <Col xs={12} xl={6} xxl={4} className="text-center">
                                <Row className="flex-column justify-content-center align-items-center mx-2 mb-2">
                                    <Button
                                        onClick={getOnClickUpgrade('basic')}
                                        href={'https://buy.stripe.com/3cs7tkcsZ6z4fTy7ss'}
                                        target="_blank"
                                        variant="secondary"
                                    >
                                        <FontAwesomeIcon icon={faRocket} className="me-1" />
                                        Upgrade to Basic ($14.99)
                                    </Button>
                                </Row>
                            </Col>
                            <Col xs={12} xl={6} xxl={4} className="text-center">
                                <Row className="flex-column justify-content-center align-items-center mx-2 mb-2">
                                    <Button
                                        onClick={getOnClickUpgrade('advanced')}
                                        href={'https://buy.stripe.com/aEUdRI78F0aGePu6op'}
                                        target="_blank"
                                        variant="secondary"
                                    >
                                        <FontAwesomeIcon icon={faRocket} className="me-1" />
                                        Upgrade to Advanced ($34.99)
                                    </Button>
                                </Row>
                            </Col>
                            <Col xs={12} xl={6} xxl={4} className="text-center">
                                <Row className="flex-column justify-content-center align-items-center mx-2 mb-2">
                                    <Button
                                        onClick={getOnClickUpgrade('pro')}
                                        href={'https://buy.stripe.com/8wM14W64Bg9E36M146'}
                                        target="_blank"
                                        variant="secondary"
                                    >
                                        <FontAwesomeIcon icon={faRocket} className="me-1" />
                                        Upgrade to Pro ($99.99)
                                    </Button>
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
