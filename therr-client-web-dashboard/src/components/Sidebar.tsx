/* eslint-disable max-len */
import React, {
    useState,
} from 'react';
import SimpleBar from 'simplebar-react';
import {
    Link,
    useLocation,
} from 'react-router-dom';
import {
    CSSTransition,
} from 'react-transition-group';
import {
    FontAwesomeIcon,
} from '@fortawesome/react-fontawesome';
import {
    faBook,
    faBoxOpen,
    faChartPie,
    faCog,
    faFileAlt,
    faHandHoldingUsd,
    faHome,
    faSignOutAlt,
    faTable,
    faTimes,
    faRocket,
} from '@fortawesome/free-solid-svg-icons';
import {
    Nav,
    Badge,
    Image,
    Button,
    Dropdown,
    Accordion,
    Navbar,
} from '@themesberg/react-bootstrap';

const TherrForBusinessLogo = '/assets/img/therr-logo.svg';
const ReactHero = '/assets/img/therr-logo.svg';
const ProfilePicture = '/assets/img/team/profile-picture-3.jpg';

const Sidebar = (props: any = {}) => {
    const location = useLocation();
    const { pathname } = location;
    const [show, setShow] = useState(false);
    const showClass = show ? 'show' : '';

    const onCollapse = () => setShow(!show);

    const CollapsableNavItem = (navProps: any) => {
        const {
            eventKey, title, icon, children = null,
        } = navProps;
        const defaultKey = pathname.indexOf(eventKey) !== -1 ? eventKey : '';

        return (
            <Accordion as={Nav.Item} defaultActiveKey={defaultKey}>
                <Accordion.Item eventKey={eventKey}>
                    <Accordion.Button as={Nav.Link} className="d-flex justify-content-between align-items-center">
                        <span>
                            <span className="sidebar-icon"><FontAwesomeIcon icon={icon} /> </span>
                            <span className="sidebar-text">{title}</span>
                        </span>
                    </Accordion.Button>
                    <Accordion.Body className="multi-level">
                        <Nav className="flex-column">
                            {children}
                        </Nav>
                    </Accordion.Body>
                </Accordion.Item>
            </Accordion>
        );
    };

    const NavItem = (itemProps: any) => {
        const {
            title, link, external, target, icon, image, badgeText, badgeBg = 'secondary', badgeColor = 'primary',
        } = itemProps;
        const classNames = badgeText ? 'd-flex justify-content-start align-items-center justify-content-between' : '';
        const navItemClassName = link === pathname ? 'active' : '';
        const linkProps: any = external ? { href: link } : { as: Link, to: link };

        return (
            <Nav.Item className={navItemClassName} onClick={() => setShow(false)}>
                <Nav.Link {...linkProps} target={target} className={classNames}>
                    <span>
                        {icon ? <span className="sidebar-icon"><FontAwesomeIcon icon={icon} /> </span> : null}
                        {image ? <Image src={image} width={20} height={20} className="sidebar-icon svg-icon" /> : null}

                        <span className="sidebar-text">{title}</span>
                    </span>
                    {badgeText ? (
                        <Badge pill bg={badgeBg} text={badgeColor} className="badge-md notification-count ms-2">{badgeText}</Badge>
                    ) : null}
                </Nav.Link>
            </Nav.Item>
        );
    };

    if (!props.show) {
        return null;
    }

    return (
        <>
            <Navbar expand={false} collapseOnSelect variant="dark" className="navbar-theme-primary px-4 d-md-none">
                <Navbar.Brand className="me-lg-5" as={Link} to={'/'}>
                    <Image src={ReactHero} className="navbar-brand-light" />
                </Navbar.Brand>
                <Navbar.Toggle as={Button} aria-controls="main-navbar" onClick={onCollapse}>
                    <span className="navbar-toggler-icon" />
                </Navbar.Toggle>
            </Navbar>
            <CSSTransition timeout={300} in={show} classNames="sidebar-transition">
                <SimpleBar className={`collapse ${showClass} sidebar d-md-block bg-primary text-white`}>
                    <div className="sidebar-inner px-4 pt-3">
                        <div className="user-card d-flex d-md-none align-items-center justify-content-between justify-content-md-center pb-4">
                            <div className="d-flex align-items-center">
                                <div className="user-avatar lg-avatar me-4">
                                    <Image src={ProfilePicture} className="card-img-top rounded-circle border-white" />
                                </div>
                                <div className="d-block">
                                    <h6>Hi, Jane</h6>
                                    <Button as={Link} variant="secondary" size="sm" to={'/'} className="text-dark">
                                        <FontAwesomeIcon icon={faSignOutAlt} className="me-2" /> Sign Out
                                    </Button>
                                </div>
                            </div>
                            <Nav.Link className="collapse-close d-md-none" onClick={onCollapse}>
                                <FontAwesomeIcon icon={faTimes} />
                            </Nav.Link>
                        </div>
                        <Nav className="flex-column pt-3 pt-md-0">
                            <NavItem title="Your Dashboard" link={'/'} icon={faHome} />

                            <NavItem title="Overview" link={'/'} icon={faChartPie} />
                            <NavItem title="Transactions" icon={faHandHoldingUsd} link={'/'} />
                            <NavItem title="Settings" icon={faCog} link={'/'} />

                            <CollapsableNavItem eventKey="tables/" title="Tables" icon={faTable}>
                                <NavItem title="Bootstrap Table" link={'/'} />
                            </CollapsableNavItem>

                            <CollapsableNavItem eventKey="examples/" title="Page Examples" icon={faFileAlt}>
                                <NavItem title="Sign In" link={'/'} />
                                <NavItem title="Sign Up" link={'/'} />
                                <NavItem title="Forgot password" link={'/'} />
                                <NavItem title="Reset password" link={'/'} />
                                <NavItem title="Lock" link={'/'} />
                                <NavItem title="404 Not Found" link={'/'} />
                                <NavItem title="500 Server Error" link={'/'} />
                            </CollapsableNavItem>

                            <Dropdown.Divider className="my-3 border-indigo" />

                            <CollapsableNavItem eventKey="documentation/" title="Getting Started" icon={faBook}>
                                <NavItem title="Overview" link={'/'} />
                                <NavItem title="Download" link={'/'} />
                                <NavItem title="Quick Start" link={'/'} />
                                <NavItem title="License" link={'/'} />
                                <NavItem title="Folder Structure" link={'/'} />
                                <NavItem title="Build Tools" link={'/'} />
                                <NavItem title="Changelog" link={'/'} />
                            </CollapsableNavItem>
                            <CollapsableNavItem eventKey="components/" title="Components" icon={faBoxOpen}>
                                <NavItem title="Accordion" link={'/'} />
                                <NavItem title="Alerts" link={'/'} />
                                <NavItem title="Badges" link={'/'} />
                                <NavItem title="Breadcrumbs" link={'/'} />
                                <NavItem title="Buttons" link={'/'} />
                                <NavItem title="Forms" link={'/'} />
                                <NavItem title="Modals" link={'/'} />
                                <NavItem title="Navbars" link={'/'} />
                                <NavItem title="Navs" link={'/'} />
                                <NavItem title="Pagination" link={'/'} />
                                <NavItem title="Popovers" link={'/'} />
                                <NavItem title="Progress" link={'/'} />
                                <NavItem title="Tables" link={'/'} />
                                <NavItem title="Tabs" link={'/'} />
                                <NavItem title="Toasts" link={'/'} />
                                <NavItem title="Tooltips" link={'/'} />
                            </CollapsableNavItem>
                            <NavItem external title="Therr for Business" link="https://business.therr.com" target="_blank" image={TherrForBusinessLogo} />
                            <Button as={Link} to={'/'} variant="secondary" className="upgrade-to-pro"><FontAwesomeIcon icon={faRocket} className="me-1" /> Upgrade to Pro</Button>
                        </Nav>
                    </div>
                </SimpleBar>
            </CSSTransition>
        </>
    );
};

export default Sidebar;
