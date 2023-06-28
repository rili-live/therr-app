import {
    faPencilRuler,
    faPlus, faRocket, faTasks, faUserShield,
} from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import React from 'react';
import { Button, Dropdown } from 'react-bootstrap';

interface IAdminManageSpacesMenuProps {
    className?: string;
    navigateHandler: (routeName: string) => any;
}

const AdminManageSpacesMenu = ({
    className,
    navigateHandler,
}: IAdminManageSpacesMenuProps) => (
    <Dropdown className={`btn-toolbar ${className}`}>
        <Dropdown.Toggle as={Button} variant="primary" size="sm" className="me-2">
            <FontAwesomeIcon icon={faTasks} className="me-2" />Manage Spaces
        </Dropdown.Toggle>
        <Dropdown.Menu className="dashboard-dropdown dropdown-menu-left mt-2">
            <Dropdown.Item className="fw-bold" onClick={navigateHandler('/manage-spaces/admin')}>
                <FontAwesomeIcon icon={faPencilRuler} className="me-2" /> Edit Spaces
            </Dropdown.Item>
        </Dropdown.Menu>
    </Dropdown>
);

export default AdminManageSpacesMenu;
