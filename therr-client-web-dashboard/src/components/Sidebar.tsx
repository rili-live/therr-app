/* eslint-disable max-len */
import React, {
    useState,
} from 'react';
import ReactGA from 'react-ga4';
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
    faBullhorn,
    faBullseye,
    faChartArea,
    faChartBar,
    faChartPie,
    faChartLine,
    faCog,
    faComments,
    faCommentAlt,
    faCommentDots,
    faHandHoldingHeart,
    faHandHoldingUsd,
    faHome,
    faMapMarked,
    faMeh,
    faSignOutAlt,
    faTimes,
    faRocket,
    faTasks,
} from '@fortawesome/free-solid-svg-icons';
import {
    Nav,
    Badge,
    Image,
    Button,
    Dropdown,
    Accordion,
    Navbar,
} from 'react-bootstrap';
import {
    AccessControl,
} from 'therr-react/components';
import getUserImageUri from '../utilities/getUserImageUri';
import { getBrandContext } from '../utilities/getHostContext';

const TherrForBusinessLogo = '/assets/img/therr-logo.svg';
const ReactHero = '/assets/img/therr-logo.svg';
const ProfilePicture = '/assets/img/team/profile-picture-3.jpg';

interface ISidebarProps {
    onLogout: (event: any) => any;
    isSuperAdmin: boolean;
    show: boolean;
    user: any;
}

const Sidebar = (props: ISidebarProps) => {
    const brandContext = getBrandContext();
    const { onLogout, isSuperAdmin, user } = props;
    const location = useLocation();
    const { pathname } = location;
    const [show, setShow] = useState(false);
    const showClass = show ? 'show' : '';
    const onClickUpgrade = () => {
        ReactGA.event('clicked_upgrade_btn', {
            source: 'sidebar-nav',
            plan: 'basic',
        });
    };

    const currentUserImageUri = getUserImageUri(user, 200);

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
            className, title, link, external, target, icon, image, badgeText, badgeBg = 'secondary', badgeColor = 'primary',
        } = itemProps;
        let classNames = badgeText ? 'd-flex justify-content-start align-items-center justify-content-between' : '';
        classNames = external ? `${classNames} open-external` : classNames;
        const navItemClassName = link === pathname ? `active ${className}` : `${className}`;
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
                                    <Image src={currentUserImageUri || ProfilePicture} className="card-img-top rounded-circle border-white" />
                                </div>
                                <div className="d-block">
                                    <h6>Hi, {user?.details?.userName}</h6>
                                    <Button variant="secondary" size="sm" onClick={onLogout} className="text-dark">
                                        <FontAwesomeIcon icon={faSignOutAlt} className="me-2" /> Logout
                                    </Button>
                                </div>
                            </div>
                            <Nav.Link className="collapse-close d-md-none" onClick={onCollapse}>
                                <FontAwesomeIcon icon={faTimes} />
                            </Nav.Link>
                        </div>
                        <Nav className="flex-column pt-3 pt-md-0">
                            <NavItem title="My Dashboard" link={'/dashboard'} icon={faHome} />
                            <AccessControl isAuthorized={isSuperAdmin}>
                                <NavItem title="Admin Dashboard" link={'/dashboard-admin'} icon={faTasks} />
                            </AccessControl>
                            <NavItem title="Claim a Space" link={'/claim-a-space'} icon={faMapMarked} />
                            <NavItem title="My Campaigns" icon={faBullhorn} link={'/campaigns/overview'} />

                            {/* <CollapsableNavItem eventKey="tables/" title="Tables" icon={faTable}>
                                <NavItem title="Bootstrap Table" link={'/'} />
                            </CollapsableNavItem> */}

                            {/* <CollapsableNavItem eventKey="examples/" title="Page Examples" icon={faFileAlt}>
                                <NavItem title="Sign In" link={'/'} />
                                <NavItem title="Sign Up" link={'/'} />
                                <NavItem title="Forgot password" link={'/'} />
                                <NavItem title="Reset password" link={'/'} />
                                <NavItem title="Lock" link={'/'} />
                                <NavItem title="404 Not Found" link={'/'} />
                                <NavItem title="500 Server Error" link={'/'} />
                            </CollapsableNavItem> */}

                            <Dropdown.Divider className="my-3 border-indigo" />

                            <CollapsableNavItem eventKey="acquisition/" title="Customer Acquisition" icon={faBullseye}>
                                <NavItem title="Overview" link={'/customer-acquisition/overview'} />
                                {/* <NavItem title="Awareness" link={'/'} icon={faChartLine} />
                                <NavItem title="Engagement" link={'/'} icon={faHandHoldingHeart} /> */}
                            </CollapsableNavItem>

                            {/* <CollapsableNavItem eventKey="metrics/" title="Customer Metrics" icon={faChartBar}>
                                <NavItem title="Overview" link={'/'} />
                                <NavItem title="Impressions" link={'/'} icon={faChartBar} />
                                <NavItem title="Interests" link={'/'} icon={faChartArea} />
                                <NavItem title="Engagement" link={'/'} icon={faChartPie} />
                            </CollapsableNavItem>

                            <CollapsableNavItem eventKey="feedback/" title="Customer Relations" icon={faComments}>
                                <NavItem title="Overview" link={'/'} />
                                <NavItem title="Communications" link={'/'} icon={faCommentDots} />
                                <NavItem title="Reviews" link={'/'} icon={faCommentAlt} />
                                <NavItem title="Sentiment" link={'/'} icon={faMeh} />
                            </CollapsableNavItem> */}

                            <Dropdown.Divider className="my-3 border-indigo" />

                            <NavItem title="Settings" icon={faCog} link={'/settings'} />
                            <CollapsableNavItem eventKey="documentation/" title="Getting Started" icon={faBook}>
                                <NavItem title="Overview" link={'/documentation/overview'} />
                                <NavItem title="Quick Start" link={'/claim-a-space'} />
                                <NavItem title="Claim a Space" link={'/claim-a-space'} />
                            </CollapsableNavItem>
                            {/* <CollapsableNavItem eventKey="components/" title="Components" icon={faBoxOpen}>
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
                            </CollapsableNavItem> */}
                            <NavItem
                                className="mb-6"
                                external
                                title={brandContext.parentHomepageName}
                                link={brandContext.parentHomepageUrl}
                                target="_blank"
                                image={brandContext.brandName === 'Therr for Business' ? 'TherrForBusinessLogo' : undefined}
                            />
                            <Button onClick={onClickUpgrade} href={'https://buy.stripe.com/3cs7tkcsZ6z4fTy7ss'} target="_blank" variant="secondary" className="upgrade-to-pro"><FontAwesomeIcon icon={faRocket} className="me-1" /> Upgrade to Pro</Button>
                        </Nav>
                    </div>
                </SimpleBar>
            </CSSTransition>
        </>
    );
};

export default Sidebar;
