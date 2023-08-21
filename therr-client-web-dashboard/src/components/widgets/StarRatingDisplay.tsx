import React from 'react';
import { Card, Col, Row } from 'react-bootstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faStar } from '@fortawesome/free-solid-svg-icons';
import { faStar as farStar } from '@fortawesome/free-regular-svg-icons';
import { IconProp } from '@fortawesome/fontawesome-svg-core';
import StarRating from './StarRating';

interface StarRatingDisplayProps {
    averageRating: number;
    totalRating: number;
    maxStars?: number;
    icon: IconProp;
    iconColor: string;
    category: string;
    title: string;
}

const StarRatingDisplay: React.FC<StarRatingDisplayProps> = ({
    averageRating,
    totalRating,
    icon,
    iconColor,
    category,
    title,
}) => (
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
                    <StarRating value={averageRating} />
                    <div className="small mt-2">
                        <p>Based on {Intl.NumberFormat().format(totalRating)} ratings</p>
                    </div>
                </Col>
            </Row>
        </Card.Body>
    </Card>
);

export default StarRatingDisplay;
