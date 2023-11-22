/* eslint-disable react/jsx-indent-props */
/* eslint-disable max-len */
import React, { useState } from 'react';
import moment from 'moment-timezone';
import Datetime from 'react-datetime';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCalendarAlt } from '@fortawesome/free-solid-svg-icons';
import { IUserState } from 'therr-react/types';
import { AccessLevels } from 'therr-js-utilities/constants';
import {
    Col, Row, Card, Form, Button, InputGroup,
} from '@themesberg/react-bootstrap';
import { Link } from 'react-router-dom';
import { IBrandConfig } from '../../utilities/getHostContext';

const FREE_PLAN = 'Freemium';

const planMap = {
    [AccessLevels.DASHBOARD_SUBSCRIBER_BASIC]: 'Basic',
    [AccessLevels.DASHBOARD_SUBSCRIBER_PREMIUM]: 'Advanced',
    [AccessLevels.DASHBOARD_SUBSCRIBER_PRO]: 'Pro',
    [AccessLevels.DASHBOARD_SUBSCRIBER_AGENCY]: 'Agency',
};

interface ISubscriptionDetailsFormProps {
    brandContext: IBrandConfig;
    user: IUserState;
}

const SubscriptionDetailsForm = ({
    brandContext,
    user,
}: ISubscriptionDetailsFormProps) => {
    const currentDay = moment().format('MMMM DD, YYYY');
    let plan = FREE_PLAN;
    const isSubscribed = user.details.accessLevels
        .some((accessLevel: AccessLevels) => {
            const matches = [
                AccessLevels.DASHBOARD_SUBSCRIBER_BASIC,
                AccessLevels.DASHBOARD_SUBSCRIBER_PREMIUM,
                AccessLevels.DASHBOARD_SUBSCRIBER_PRO,
                AccessLevels.DASHBOARD_SUBSCRIBER_AGENCY,
            ].includes(accessLevel);

            if (matches) {
                plan = planMap[accessLevel];
            }

            return matches;
        });

    return (
        <Card border="light" className="bg-white shadow-sm mb-4 text-center">
            <Card.Body>
                <h2 className="display-3 mb-3">
                    {brandContext.brandName} <span className="pro-badge subscription-badge bg-secondary fw-bolder p-1 px-2 shadow rounded-pill">
                        {isSubscribed ? 'Subscribed' : 'Free'}
                    </span>
                </h2>
                <p>Switch your subscription to a different type, such as a monthly/annual plan, or basic/advanced/pro plan.</p>
                {/* <p className="text-dark my-4">Next payment of <span className="fw-bold">$36 (yearly)</span>{` occurs on ${currentDay}.`}</p> */}
                <p>Current Plan: <span className="fw-bolder">{plan}</span></p>

                {
                    plan !== FREE_PLAN
                    && <Card.Link
                        as={Button}
                        variant="outline-gray-800"
                        size="sm"
                        className="me-2"
                        href={`mailto:${brandContext.contactEmail}?subject=Cancel%20Subscription%20Plan&Body=My%20User%20ID%20is%20${user.details.id}`}
                        target="_blank"
                    >
                        Cancel subscription
                    </Card.Link>
                }
                {
                    plan === FREE_PLAN
                        ? <Button
                            as={Link}
                            variant="secondary"
                            size="sm"
                            to={'/campaigns/overview'}
                        >
                            Change plan
                        </Button>
                        : <Button
                            variant="secondary"
                            size="sm"
                            href={`mailto:${brandContext.contactEmail}?subject=Change%20Subscription%20Plan&Body=My%20User%20ID%20is%20${user.details.id}`}
                            target="_blank"
                        >
                            Change plan
                        </Button>
                }
            </Card.Body>
        </Card>
    );
};

export default SubscriptionDetailsForm;
