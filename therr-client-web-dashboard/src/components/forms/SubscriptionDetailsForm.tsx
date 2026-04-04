/* eslint-disable react/jsx-indent-props */
/* eslint-disable max-len */
import React, { useState } from 'react';
import { IUserState } from 'therr-react/types';
import { AccessLevels } from 'therr-js-utilities/constants';
import UsersService from 'therr-react/services/UsersService';
import {
    Card, Button,
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
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
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

    const handleManageSubscription = () => {
        setIsLoading(true);
        setError('');
        UsersService.createCustomerPortalSession()
            .then((response) => {
                if (response.data?.url) {
                    window.location.href = response.data.url;
                } else {
                    setIsLoading(false);
                    setError('Failed to load subscription management. Please try again.');
                }
            })
            .catch(() => {
                setIsLoading(false);
                setError('Failed to load subscription management. Please try again.');
            });
    };

    return (
        <Card border="light" className="bg-white shadow-sm mb-4 text-center">
            <Card.Body>
                <h2 className="display-3 mb-3">
                    {brandContext.brandName} <span className="pro-badge subscription-badge bg-secondary fw-bolder p-1 px-2 shadow rounded-pill">
                        {isSubscribed ? 'Subscribed' : 'Free'}
                    </span>
                </h2>
                <p>Switch your subscription to a different type, such as a monthly/annual plan, or basic/advanced/pro plan.</p>
                <p>Current Plan: <span className="fw-bolder">{plan}</span></p>

                {error && <p className="text-danger mb-3">{error}</p>}
                {
                    plan !== FREE_PLAN
                    && <Button
                        variant="outline-gray-800"
                        size="sm"
                        className="me-2"
                        disabled={isLoading}
                        onClick={handleManageSubscription}
                    >
                        {isLoading ? 'Loading...' : 'Manage subscription'}
                    </Button>
                }
                {
                    plan === FREE_PLAN
                    && <Button
                        as={Link}
                        variant="secondary"
                        size="sm"
                        to={'/campaigns/overview'}
                    >
                        Upgrade plan
                    </Button>
                }
            </Card.Body>
        </Card>
    );
};

export default SubscriptionDetailsForm;
