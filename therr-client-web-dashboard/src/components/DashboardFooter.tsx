/* eslint-disable max-len */
import React from 'react';
import moment from 'moment-timezone';
import classNames from 'classnames';
import {
    Row,
    Col,
    Card,
    OverlayTrigger,
    Tooltip,
    Image,
    Button,
} from '@themesberg/react-bootstrap';
import {
    FontAwesomeIcon,
} from '@fortawesome/react-fontawesome';
import {
    faCogs,
    faDownload,
    faRocket,
} from '@fortawesome/free-solid-svg-icons';
import { getBrandContext } from '../utilities/getHostContext';

const BS5Logo = '/assets/img/technologies/bootstrap-5-logo.svg';
const ReactLogo = '/assets/img/technologies/react-logo.svg';
const LaravelLogo = '/assets/img/technologies/laravel-logo.svg';

const DashboardFooter = (props: any) => {
    const brandContext = getBrandContext();
    const currentYear = moment().get('year');
    const showSettings = props.showSettings;

    const toggleSettings = (toggle) => {
        props.toggleSettings(toggle);
    };

    const containerStyles = classNames({
        footer: true,
        'p-5': true,
        'mb-4': true,
        'mt-4': true,
        'bg-white': !props.isLandingStylePage,
        rounded: !props.isLandingStylePage,
        'shadow-sm': !props.isLandingStylePage,
        card: !props.isLandingStylePage,
    });

    return (
        <div>
            {/* {showSettings ? (
                <Card className="theme-settings">
                    <Card.Body className="pt-4">
                        <Button className="theme-settings-close" variant="close" size="sm" aria-label="Close" onClick={() => { toggleSettings(false); }} />
                        <Button href="https://business.therr.com/" target="_blank" variant="primary" className="mb-3 w-100"><FontAwesomeIcon icon={faDownload} className="me-1" /> Download</Button>
                        <p className="fs-7 text-gray-700 text-center">Available in the following technologies:</p>
                        <div className="d-flex justify-content-center">
                            <Card.Link href="https://business.therr.com/" target="_blank">
                                <OverlayTrigger placement="top" trigger={['hover', 'focus']} overlay={<Tooltip id="bs5logo_tooltip">Bootstrap 5 · The most popular HTML, CSS, and JS library in the world.</Tooltip>}>
                                    <Image src={BS5Logo} className="image image-xs" />
                                </OverlayTrigger>
                            </Card.Link>

                            <Card.Link href="https://business.therr.com/" target="_blank">
                                <OverlayTrigger placement="top" trigger={['hover', 'focus']} overlay={<Tooltip id="react_link_tooltip">React · A JavaScript library for building user interfaces.</Tooltip>}>
                                    <Image src={ReactLogo} className="image image-xs" />
                                </OverlayTrigger>
                            </Card.Link>

                            <Card.Link href="https://business.therr.com/" target="_blank">
                                <OverlayTrigger placement="top" trigger={['hover', 'focus']} overlay={<Tooltip id="template_link_tooltip">Laravel · Most popular PHP framework in the world.</Tooltip>}>
                                    <Image src={LaravelLogo} className="image image-xs" />
                                </OverlayTrigger>
                            </Card.Link>

                        </div>
                    </Card.Body>
                </Card>
            ) : (
                <Card className="theme-settings theme-settings-expand" onClick={() => { toggleSettings(true); }}>
                    <Card.Body className="p-3 py-2">
                        <span className="fw-bold h6"><FontAwesomeIcon icon={faCogs} className="me-1 fs-7" /> Chat</span>
                    </Card.Body>
                </Card>
            )} */}
            <footer className={containerStyles}>
                <Row>
                    <Col xs={12} lg={6} className="mb-4 mb-lg-0">
                        <p className="mb-0 text-center text-xl-left">
                            Copyright © 2020-{`${currentYear} `}
                            <Card.Link href={brandContext.parentHomepageUrl} target="_blank" className="text-blue text-decoration-none fw-normal">
                                {brandContext.parentHomepageName}
                            </Card.Link>
                        </p>
                    </Col>
                    <Col xs={12} lg={6}>
                        <ul className="list-inline list-group-flush list-group-borderless text-center text-xl-right mb-0">
                            <li className="list-inline-item px-0 px-sm-2">
                                <Card.Link href={brandContext.parentAboutUrl} target="_blank">
                                    About
                                </Card.Link>
                            </li>
                            <li className="list-inline-item px-0 px-sm-2">
                                <Card.Link href={brandContext.parentBlogUrl} target="_blank">
                                    Blog
                                </Card.Link>
                            </li>
                            <li className="list-inline-item px-0 px-sm-2">
                                <Card.Link href={brandContext.parentAppUrl} target="_blank">
                                    {brandContext.parentAppName}
                                </Card.Link>
                            </li>
                            <li className="list-inline-item px-0 px-sm-2">
                                <Card.Link href={brandContext.parentContactUrl} target="_blank">
                                    Contact
                                </Card.Link>
                            </li>
                        </ul>
                    </Col>
                </Row>
            </footer>
        </div>
    );
};

export default DashboardFooter;
