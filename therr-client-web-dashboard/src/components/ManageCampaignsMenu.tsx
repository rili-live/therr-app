import ReactGA from 'react-ga4';
import {
    faPencilRuler,
    faPlus, faRocket, faTasks, faUserShield,
} from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import React from 'react';
import { Button, Dropdown } from 'react-bootstrap';
import { UsersService } from 'therr-react/services';
import { AccessCheckType, IUserState } from 'therr-react/types';
import { AccessLevels } from 'therr-js-utilities/constants';

interface IManageCampaignsMenuProps {
    className?: string;
    navigateHandler: (routeName: string) => any;
    user: IUserState;
}

const ManageCampaignsMenu = ({
    className,
    navigateHandler,
    user,
}: IManageCampaignsMenuProps) => {
    const onClickUpgrade = () => {
        ReactGA.event('clicked_upgrade_btn', {
            source: 'manage-campaigns-menu',
            plan: 'basic',
        });
    };

    const isSubscribed = UsersService.isAuthorized(
        {
            type: AccessCheckType.ANY,
            levels: [
                AccessLevels.DASHBOARD_SUBSCRIBER_BASIC,
                AccessLevels.DASHBOARD_SUBSCRIBER_PREMIUM,
                AccessLevels.DASHBOARD_SUBSCRIBER_PRO,
                AccessLevels.DASHBOARD_SUBSCRIBER_AGENCY],
            isPublic: true,
        },
        user,
    );

    return (
        <Dropdown className={`btn-toolbar ${className}`}>
            <Dropdown.Toggle as={Button} variant="primary" size="sm" className="me-2">
                <FontAwesomeIcon icon={faTasks} className="me-2" />Manage Campaigns
            </Dropdown.Toggle>
            <Dropdown.Menu className="dashboard-dropdown dropdown-menu-left mt-2">
                <Dropdown.Item className="fw-bold" onClick={navigateHandler('/campaigns/create')}>
                    <FontAwesomeIcon icon={faPlus} className="me-2" /> Create a Campaign
                </Dropdown.Item>
                <Dropdown.Item className="fw-bold" onClick={navigateHandler('/campaigns/overview')}>
                    <FontAwesomeIcon icon={faPencilRuler} className="me-2" /> Edit My Campaigns
                </Dropdown.Item>
                {/* <Dropdown.Item className="fw-bold" onClick={navigateHandler('/campaigns/edit')}>
                    <FontAwesomeIcon icon={faUserShield} className="me-2" /> Manage Access
                </Dropdown.Item> */}
                {
                    !isSubscribed
                    && <>
                        <Dropdown.Divider />
                        <Dropdown.Item onClick={onClickUpgrade} href={'https://buy.stripe.com/3cs7tkcsZ6z4fTy7ss'} target="_blank" className="fw-bold">
                            <FontAwesomeIcon icon={faRocket} className="text-danger me-2" /> Upgrade to Pro
                        </Dropdown.Item>
                    </>
                }
            </Dropdown.Menu>
        </Dropdown>
    );
};

export default ManageCampaignsMenu;
