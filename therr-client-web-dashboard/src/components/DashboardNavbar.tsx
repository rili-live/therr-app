import React, {
    useState,
} from 'react';
import {
    FontAwesomeIcon,
} from '@fortawesome/react-fontawesome';
import {
    faBell,
    faCog,
    faSearch,
    faSignOutAlt,
    faUserShield,
} from '@fortawesome/free-solid-svg-icons';
import {
    faUserCircle,
} from '@fortawesome/free-regular-svg-icons';
import {
    Row,
    Nav,
    Form,
    Image,
    Navbar,
    Dropdown,
    Container,
    ListGroup,
    InputGroup,
} from 'react-bootstrap';
import {
    NotificationActions,
} from 'therr-react/redux/actions';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import { INotificationsState, INotification, IMapState } from 'therr-react/types';
import getUserImageUri from '../utilities/getUserImageUri';

const MAX_NOTIFICATIONS_IN_VIEW = 8;

const mapStateToProps = (state: any) => ({
    notifications: state.notifications,
});

const mapDispatchToProps = (dispatch: any) => bindActionCreators({
    updateNotification: NotificationActions.update,
}, dispatch);

const Profile3 = '/assets/img/team/profile-picture-3.jpg';

interface IStoreProps {
    notifications: INotificationsState;
    updateNotification: Function;
}

interface IDashboardNavbarProps extends IStoreProps{
    map: IMapState;
    navToSettings: () => any;
    onLogout: React.MouseEventHandler<any>;
    onSearchInpuChange: React.ChangeEventHandler<HTMLInputElement>;
    user: any;
}

const Notification = (notificationProps: any) => {
    const {
        sender, link, message, createdAt, isUnread = true,
    } = notificationProps;
    const readClassName = isUnread ? '' : 'text-danger';

    // Notifications Display Styling
    return (
        <ListGroup.Item action href={link} className="border-bottom border-light">
            <Row className="align-items-center">
                <div className="d-flex justify-content-between align-items-center">
                    <div>
                        <h4 className="h6 mb-0 text-small">{sender}</h4>
                    </div>
                    <div className="text-end">
                        <small className={readClassName}>{createdAt}</small>
                    </div>
                </div>
                <p className="font-small mt-1 mb-0">{message}</p>
            </Row>
        </ListGroup.Item>
    );
};

const DashboardNavbar = (props: IDashboardNavbarProps) => {
    const {
        user, map, notifications, onSearchInpuChange, updateNotification,
    } = props;
    const messagesSlice = notifications.messages.slice(0, MAX_NOTIFICATIONS_IN_VIEW);
    const areNotificationsRead = notifications.messages.reduce((acc: boolean, notif: INotification) => acc && notif.isUnread, false);
    const currentUserImageUri = getUserImageUri(user, 200);
    // TODO: Display search dropdown and callback on select
    const isSearchDropdownVisible = map?.searchPredictions?.isSearchDropdownVisible;

    return (
        <Navbar variant="dark" expanded className="ps-0 pe-2 pb-0">
            <Container fluid className="px-0">
                <div className="d-flex justify-content-between w-100">
                    <div className="d-flex align-items-center">
                        <Form className="navbar-search">
                            <Form.Group id="topbarSearch">
                                <InputGroup className="input-group-merge search-bar">
                                    <InputGroup.Text><FontAwesomeIcon icon={faSearch} /></InputGroup.Text>
                                    <Form.Control type="text" placeholder="Search" onChange={onSearchInpuChange} />
                                </InputGroup>
                            </Form.Group>
                        </Form>
                    </div>
                    <Nav className="align-items-center">
                        <Dropdown as={Nav.Item}>
                            <Dropdown.Toggle as={Nav.Link} className="text-dark icon-notifications me-lg-3">
                                <span className="icon icon-sm">
                                    <FontAwesomeIcon icon={faBell} className="bell-shake" />
                                    {areNotificationsRead ? null : <span className="icon-badge rounded-circle unread-notifications" />}
                                </span>
                            </Dropdown.Toggle>
                            <Dropdown.Menu className="dashboard-dropdown notifications-dropdown dropdown-menu-lg dropdown-menu-center mt-2 py-0">
                                <ListGroup className="list-group-flush">
                                    <Nav.Link href="#" className="text-center text-primary fw-bold border-bottom border-light py-3">
                                        Notifications
                                    </Nav.Link>
                                    {
                                        messagesSlice.map((n: INotification) => (
                                            <Notification
                                                key={n.id}
                                                message={n.message}
                                                isUnread={n.isUnread}
                                            />
                                        ))
                                    }
                                    <Dropdown.Item className="text-center text-primary fw-bold py-3">
                                        View all
                                    </Dropdown.Item>
                                </ListGroup>
                            </Dropdown.Menu>
                        </Dropdown>

                        <Dropdown as={Nav.Item}>
                            <Dropdown.Toggle as={Nav.Link} className="pt-1 px-0">
                                <div className="media d-flex align-items-center">
                                    <Image src={currentUserImageUri || Profile3} className="user-avatar md-avatar rounded-circle" />
                                    <div className="media-body ms-2 text-dark align-items-center d-none d-lg-block">
                                        <span className="mb-0 font-small fw-bold">{user?.details?.userName}</span>
                                    </div>
                                </div>
                            </Dropdown.Toggle>
                            <Dropdown.Menu className="user-dropdown dropdown-menu-right mt-2">
                                <Dropdown.Item className="fw-bold" onClick={props.navToSettings}>
                                    <FontAwesomeIcon icon={faUserCircle} className="me-2" /> My Profile
                                </Dropdown.Item>
                                <Dropdown.Item className="fw-bold" onClick={props.navToSettings}>
                                    <FontAwesomeIcon icon={faCog} className="me-2" /> Settings
                                </Dropdown.Item>
                                {/* <Dropdown.Item className="fw-bold">
                                    <FontAwesomeIcon icon={faEnvelopeOpen} className="me-2" /> Messages
                                </Dropdown.Item> */}
                                <Dropdown.Item className="fw-bold" href="mailto:info@therr.com" target="_blank">
                                    <FontAwesomeIcon icon={faUserShield} className="me-2" /> Support
                                </Dropdown.Item>

                                <Dropdown.Divider />

                                <Dropdown.Item className="fw-bold" onClick={props.onLogout}>
                                    <FontAwesomeIcon icon={faSignOutAlt} className="text-danger me-2" /> Logout
                                </Dropdown.Item>
                            </Dropdown.Menu>
                        </Dropdown>
                    </Nav>
                </div>
            </Container>
        </Navbar>
    );
};

export default connect(mapStateToProps, mapDispatchToProps)(DashboardNavbar);
