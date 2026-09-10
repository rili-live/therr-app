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
import { startCheckout } from '../utilities/startCheckout';

interface IManageSpacesMenuProps {
    className?: string;
    navigateHandler: (routeName: string) => any;
    user: IUserState;
}

const ManageSpacesMenu = ({
    className,
    navigateHandler,
    user,
}: IManageSpacesMenuProps) => {
    // Labelled "Upgrade to Pro" but has always sold the *basic* plan — this
    // menu's Payment Link and its `clicked_upgrade_btn` event both said basic.
    // Preserved rather than corrected: changing it changes what a customer is
    // charged, which is a pricing decision, not an attribution one.
    const onClickUpgrade = () => startCheckout({ plan: 'basic', eventSource: 'manage-spaces-menu' });

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
                <FontAwesomeIcon icon={faTasks} className="me-2" />Manage Spaces
            </Dropdown.Toggle>
            <Dropdown.Menu className="dashboard-dropdown dropdown-menu-left mt-2">
                <Dropdown.Item className="fw-bold" onClick={navigateHandler('/claim-a-space')}>
                    <FontAwesomeIcon icon={faPlus} className="me-2" /> Claim a Space
                </Dropdown.Item>
                <Dropdown.Item className="fw-bold" onClick={navigateHandler('/spaces')}>
                    <FontAwesomeIcon icon={faPencilRuler} className="me-2" /> Edit My Spaces
                </Dropdown.Item>
                {/* <Dropdown.Item className="fw-bold" onClick={navigateHandler('/claim-a-space')}>
                    <FontAwesomeIcon icon={faUserShield} className="me-2" /> Manage Access
                </Dropdown.Item> */}
                {
                    !isSubscribed
                    && <>
                        <Dropdown.Divider />
                        <Dropdown.Item onClick={onClickUpgrade} className="fw-bold">
                            <FontAwesomeIcon icon={faRocket} className="text-danger me-2" /> Upgrade to Pro
                        </Dropdown.Item>
                    </>
                }
            </Dropdown.Menu>
        </Dropdown>
    );
};

export default ManageSpacesMenu;
