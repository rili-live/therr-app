import React from 'react';
import {
    FontAwesomeIcon,
} from '@fortawesome/react-fontawesome';
import {
    faAngleDown,
    faAngleUp,
    faGlobeEurope,
} from '@fortawesome/free-solid-svg-icons';
import {
    Card,
    Button,
    Row,
    Col,
} from 'react-bootstrap';
import { IconProp } from '@fortawesome/fontawesome-svg-core';

interface ICounterWidgetProps {
    icon: IconProp;
    iconColor: string;
    category: string;
    title: string;
    period: string;
    percentage: number;
}

const CounterWidget = ({
    icon,
    iconColor,
    category,
    title,
    period,
    percentage,
}: ICounterWidgetProps) => {
    const percentageIcon = percentage < 0 ? faAngleDown : faAngleUp;
    const percentageColor = percentage < 0 ? 'text-danger' : 'text-success';

    return (
        <Card border="light" className="shadow-sm">
            <Card.Body>
                <Row className="d-block d-xl-flex align-items-center">
                    <Col xl={5} className="text-xl-center d-flex align-items-center justify-content-xl-center mb-3 mb-xl-0">
                        <div className={`icon icon-shape icon-md icon-${iconColor} rounded me-4 me-sm-0`}>
                            <FontAwesomeIcon icon={icon} />
                        </div>
                        <div className="d-sm-none">
                            <h5>{category}</h5>
                            <h3 className="mb-1">{title}</h3>
                        </div>
                    </Col>
                    <Col xs={12} xl={7} className="px-xl-0">
                        <div className="d-none d-sm-block">
                            <h5>{category}</h5>
                            <h3 className="mb-1">{title}</h3>
                        </div>
                        <small>{`This ${period}`}</small>
                        <div className="small mt-2">
                            <FontAwesomeIcon icon={percentageIcon} className={`${percentageColor} me-1`} />
                            <span className={`${percentageColor} fw-bold`}>
                                {percentage}%
                            </span> {`Since last ${period}`}
                        </div>
                    </Col>
                </Row>
            </Card.Body>
        </Card>
    );
};

export default CounterWidget;
