/* eslint-disable max-len */
import React, { useState } from 'react';
import {
    Col, Row, Card, Form, Button, Image, InputGroup,
} from 'react-bootstrap';
import classNames from 'classnames';
import { Typeahead } from 'react-bootstrap-typeahead';
import { Option } from 'react-bootstrap-typeahead/types/types';
import { CampaignAssetTypes, CampaignStatuses, CampaignTypes, OAuthIntegrationProviders } from 'therr-js-utilities/constants';
import { IUserState } from 'therr-react/types';
import Datetime from 'react-datetime';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faCalendarAlt, faCheckCircle, faExclamationCircle, faMapMarked, faPlusCircle, faTimesCircle,
} from '@fortawesome/free-solid-svg-icons';
import moment, { Moment } from 'moment';
import {
    faFacebook, faGoogle, faInstagram, faLinkedin, faTwitter,
} from '@fortawesome/free-brands-svg-icons';
import Dropzone from './Dropzone';
import { ICampaignAsset } from '../../types';
import getUserContentUri from '../../utilities/getUserContentUri';

export const isAdsProviderAuthenticated = (user: IUserState, target: string) => {
    // TODO: Refresh token if almost expired
    const combinedTarget = target === OAuthIntegrationProviders.INSTAGRAM
        ? OAuthIntegrationProviders.FACEBOOK
        : target;

    if (combinedTarget === OAuthIntegrationProviders.THERR) { return true; }

    return user?.settings?.integrations
        && user.settings.integrations[combinedTarget]?.user_access_token
        && user.settings.integrations[combinedTarget]?.user_access_token_expires_at
        && user.settings.integrations[combinedTarget].user_access_token_expires_at > Date.now();
};

const adTypeCategories = [
    CampaignTypes.LOCAL,
    CampaignTypes.AWARENESS,
    CampaignTypes.ACQUISITION,
    CampaignTypes.ENGAGEMENT,
    CampaignTypes.LEADS,
    CampaignTypes.SALES,
];

const statusOptions = [
    CampaignStatuses.ACTIVE,
    CampaignStatuses.PAUSED,
    CampaignStatuses.REMOVED,
];

const disabledProvidersStatus = {
    [OAuthIntegrationProviders.THERR]: false,
    [OAuthIntegrationProviders.FACEBOOK]: false,
    [OAuthIntegrationProviders.INSTAGRAM]: false,
    [OAuthIntegrationProviders.LINKEDIN]: true,
    [OAuthIntegrationProviders.GOOGLE]: true,
    [OAuthIntegrationProviders.TWITTER]: true,
};

interface IEditCampaignFormProps {
    formStage: number;
    addressTypeAheadResults: any[],
    hasFormChanged: boolean;
    goBack: (event: React.MouseEvent<HTMLButtonElement>) => void;
    inputs: {
        title: string;
        description: string;
        type: string;
        status: string;
        scheduleStartAt: string;
        scheduleStopAt: string;
        address?: Option[];
        category?: string;
        phoneNumber?: string;
        websiteUrl?: string;
        menuUrl?: string;
        orderUrl?: string;
        reservationUrl?: string;
        integrationTargets: string[];
        integrationDetails: {
            [key: string]: {
                pageId: string;
                adAccountId: string;
                maxBudget: number;
            };
        };
        spaceId?: string;
        adGroup: {
            id?: string;
            headline: string;
            description: string;
            assets: any[];
        };
        targetLocations: {
            label: string;
            latitude: number;
            longitude: number;
        }[];
    }
    navigateHandler: (routeName: string) => any;
    fetchedIntegrationDetails: {
        [key: string]: any;
    };
    isEditing: boolean;
    isSubmitDisabled: boolean;
    mediaUrl?: string;
    mediaAssets: ICampaignAsset[] ;
    onAddressTypeaheadChange: (text: string, event: React.ChangeEvent<HTMLInputElement>) => void,
    onAddressTypeAheadSelect: (selected: Option[]) => void;
    onAssetInputChange: (event, assetIndex: number, name: string, value: number | string) => any;
    onInputChange: React.ChangeEventHandler<HTMLInputElement>;
    onIntegrationDetailsChange: (integrationProvider: string, event: React.ChangeEvent<any>) => void,
    onDateTimeChange: (name: string, value: string | Moment) => void;
    onRemoveTargetLocation: (label: string) => any;
    onSocialSyncPress: any;
    onSubmit: (event: React.MouseEvent<HTMLButtonElement>|React.FormEvent<HTMLButtonElement>) => void;
    onSelectMedia: (files: any[]) => any;
    removeMediaAsset: (id: string) => any;
    shouldShowAdvancedFields?: boolean;
    mySpaces: {
        id: string;
        notificationMsg: string;
    }[];
    user: IUserState;
}

const EditCampaignForm = ({
    addressTypeAheadResults,
    formStage,
    goBack,
    mediaUrl,
    mediaAssets,
    navigateHandler,
    hasFormChanged,
    inputs,
    fetchedIntegrationDetails,
    isEditing,
    isSubmitDisabled,
    onAddressTypeAheadSelect,
    onAddressTypeaheadChange,
    onAssetInputChange,
    onInputChange,
    onIntegrationDetailsChange,
    onDateTimeChange,
    onRemoveTargetLocation,
    onSocialSyncPress,
    onSubmit,
    onSelectMedia,
    removeMediaAsset,
    shouldShowAdvancedFields,
    mySpaces,
    user,
}: IEditCampaignFormProps) => {
    const isTherrSelected = inputs.integrationTargets?.includes(OAuthIntegrationProviders.THERR);
    const isGoogleSelected = inputs.integrationTargets?.includes(OAuthIntegrationProviders.GOOGLE);
    const isFacebookSelected = inputs.integrationTargets?.includes(OAuthIntegrationProviders.FACEBOOK);
    const isInstagramSelected = inputs.integrationTargets?.includes(OAuthIntegrationProviders.INSTAGRAM);
    const isTwitterSelected = inputs.integrationTargets?.includes(OAuthIntegrationProviders.TWITTER);
    const isLinkedInSelected = inputs.integrationTargets?.includes(OAuthIntegrationProviders.LINKEDIN);
    const therrCardClassNames = classNames({
        'ad-provider-card': true,
        selected: isTherrSelected,
        disabled: disabledProvidersStatus[OAuthIntegrationProviders.THERR],
        shadow: !isTherrSelected,
        'shadow-sm': isTherrSelected,
    });
    const facebookCardClassNames = classNames({
        'ad-provider-card': true,
        selected: isFacebookSelected,
        disabled: disabledProvidersStatus[OAuthIntegrationProviders.FACEBOOK],
        shadow: !isFacebookSelected,
        'shadow-sm': isFacebookSelected,
    });
    const instagramCardClassNames = classNames({
        'ad-provider-card': true,
        selected: isInstagramSelected,
        disabled: disabledProvidersStatus[OAuthIntegrationProviders.INSTAGRAM],
        shadow: !isInstagramSelected,
        'shadow-sm': isInstagramSelected,
    });
    const linkedInCardClassNames = classNames({
        'ad-provider-card': true,
        selected: isLinkedInSelected,
        disabled: disabledProvidersStatus[OAuthIntegrationProviders.LINKEDIN],
        shadow: !isLinkedInSelected,
        'shadow-sm': isLinkedInSelected,
    });
    const googleCardClassNames = classNames({
        'ad-provider-card': true,
        selected: isGoogleSelected,
        disabled: disabledProvidersStatus[OAuthIntegrationProviders.GOOGLE],
        shadow: !isGoogleSelected,
        'shadow-sm': isGoogleSelected,
    });
    const twitterCardClassNames = classNames({
        'ad-provider-card': true,
        selected: isTwitterSelected,
        disabled: disabledProvidersStatus[OAuthIntegrationProviders.TWITTER],
        shadow: !isTwitterSelected,
        'shadow-sm': isTwitterSelected,
    });

    return (
        <Card border="light" className="bg-white shadow-sm mb-4">
            <Card.Header>
                {
                    isEditing
                        ? <h1 className="text-center">Edit Campaign</h1>
                        : <h1 className="text-center">Create a Marketing Campaign</h1>
                }
            </Card.Header>
            <Card.Body>
                {
                    formStage === 1
                    && <Form>
                        <Row>
                            <Col md={8}>
                                <h5 className="my-4">General Campaign Information</h5>
                                <Row>
                                    <Col lg={6} className="mb-3">
                                        <Form.Group controlId="title">
                                            <Form.Label className="required" aria-required>Campaign Name</Form.Label>
                                            <Form.Control
                                                value={inputs.title}
                                                name="title"
                                                onChange={onInputChange}
                                                type="text"
                                                placeholder="The name or title of your campaign"
                                                required
                                                aria-required
                                            />
                                        </Form.Group>
                                    </Col>
                                    <Col lg={6} className="mb-3">
                                        <Form.Group controlId="type">
                                            <Form.Label>Ad Type</Form.Label>
                                            <Form.Control
                                                value={inputs.type}
                                                name="type"
                                                onChange={onInputChange}
                                                as="select"
                                                disabled={isEditing}
                                            >
                                                {
                                                    adTypeCategories.map((cat, index) => (
                                                        <option key={index} value={cat}>{cat}</option>
                                                    ))
                                                }
                                            </Form.Control>
                                        </Form.Group>
                                    </Col>
                                </Row>
                                <Row>
                                    <Col lg={12} className="mb-3">
                                        <Form.Group controlId="description">
                                            <Form.Label>Campaign Description</Form.Label>
                                            <Form.Control
                                                value={inputs.description}
                                                as="textarea"
                                                required
                                                type="text"
                                                name="description"
                                                onChange={onInputChange}
                                                placeholder="Add a description of the campaign for future reference..."
                                                maxLength={1000}
                                                rows={5}
                                            />
                                        </Form.Group>
                                    </Col>
                                </Row>
                            </Col>
                            <Col md={4}>
                                <h5 className="my-4">Campaign Schedule</h5>
                                <Row className="align-items-center">
                                    <Col lg={12} className="mb-3">
                                        <Form.Group id="scheduleStartAt">
                                            <Form.Label>Start Date/Time</Form.Label>
                                            <Datetime
                                                timeFormat={true}
                                                onChange={(value) => onDateTimeChange('scheduleStartAt', value)}
                                                initialViewDate={inputs.scheduleStartAt || new Date()}
                                                renderInput={(props, openCalendar) => (
                                                    <InputGroup>
                                                        <InputGroup.Text><FontAwesomeIcon icon={faCalendarAlt} /></InputGroup.Text>
                                                        <Form.Control
                                                            required
                                                            type="text"
                                                            value={inputs.scheduleStartAt ? moment(inputs.scheduleStartAt).format('MM/DD/YYYY h:mm A') : ''}
                                                            placeholder="mm/dd/yyyy"
                                                            onFocus={() => openCalendar()}
                                                            onChange={() => null}
                                                        />
                                                    </InputGroup>
                                                )} />
                                        </Form.Group>
                                    </Col>
                                </Row>
                                <Row className="align-items-center">
                                    <Col lg={12} className="mb-3">
                                        <Form.Group id="scheduleStopAt">
                                            <Form.Label>End Date/Time</Form.Label>
                                            <Datetime
                                                timeFormat={true}
                                                onChange={(value) => onDateTimeChange('scheduleStopAt', value)}
                                                initialViewDate={inputs.scheduleStopAt || new Date()}
                                                renderInput={(props, openCalendar) => (
                                                    <InputGroup>
                                                        <InputGroup.Text><FontAwesomeIcon icon={faCalendarAlt} /></InputGroup.Text>
                                                        <Form.Control
                                                            required
                                                            type="text"
                                                            value={inputs.scheduleStopAt ? moment(inputs.scheduleStopAt).format('MM/DD/YYYY h:mm A') : ''}
                                                            placeholder="mm/dd/yyyy"
                                                            onFocus={() => openCalendar()}
                                                            onChange={() => null}
                                                        />
                                                    </InputGroup>
                                                )} />
                                        </Form.Group>
                                    </Col>
                                </Row>
                                <Row className="align-items-center">
                                    <Col lg={12} className="mb-3">
                                        <Form.Group controlId="status">
                                            <Form.Label>Status</Form.Label>
                                            <Form.Control
                                                value={inputs.status}
                                                name="status"
                                                onChange={onInputChange}
                                                as="select"
                                            >
                                                {
                                                    statusOptions.map((cat, index) => (
                                                        <option key={index} value={cat}>{cat}</option>
                                                    ))
                                                }
                                            </Form.Control>
                                        </Form.Group>
                                    </Col>
                                </Row>
                            </Col>
                        </Row>
                        <Row>
                            <Col sm={12}>
                                <h5 className="my-4">Ad Provider Targets</h5>
                            </Col>
                            <Col sm={12} md={6} lg={4} xxl={2} className="mb-3">
                                <Card
                                    className={therrCardClassNames}
                                    onClick={() => !disabledProvidersStatus[OAuthIntegrationProviders.THERR]
                                        && onSocialSyncPress(OAuthIntegrationProviders.THERR)}>
                                    {
                                        isTherrSelected
                                            && <div className="position-absolute top-0 right-0">
                                                <FontAwesomeIcon
                                                    icon={isAdsProviderAuthenticated(user, OAuthIntegrationProviders.THERR)
                                                        ? faCheckCircle
                                                        : faExclamationCircle
                                                    }
                                                    className={isAdsProviderAuthenticated(user, OAuthIntegrationProviders.THERR)
                                                        ? 'm-2 text-success'
                                                        : 'm-2 text-warning'
                                                    }
                                                />
                                            </div>
                                    }
                                    <Card.Body className="text-center">
                                        <Card.Img
                                            src={'/assets/img/therr-logo-green.svg'}
                                            alt="Therr Ads"
                                            className={!disabledProvidersStatus[OAuthIntegrationProviders.THERR] ? 'text-therr' : ''}
                                            height={32}
                                            width={32}
                                        />
                                        <Card.Text className="mb-0">Therr</Card.Text>
                                        <Card.Text>{!disabledProvidersStatus[OAuthIntegrationProviders.THERR] ? '' : '(Coming Soon!)'}</Card.Text>
                                    </Card.Body>
                                </Card>
                            </Col>
                            <Col sm={12} md={6} lg={4} xxl={2} className="mb-3">
                                <Card
                                    className={facebookCardClassNames}
                                    onClick={() => !disabledProvidersStatus[OAuthIntegrationProviders.FACEBOOK]
                                        && onSocialSyncPress(OAuthIntegrationProviders.FACEBOOK)}>
                                    {
                                        isFacebookSelected
                                            && <div className="position-absolute top-0 right-0">
                                                <FontAwesomeIcon
                                                    icon={isAdsProviderAuthenticated(user, OAuthIntegrationProviders.FACEBOOK)
                                                        ? faCheckCircle
                                                        : faExclamationCircle
                                                    }
                                                    className={isAdsProviderAuthenticated(user, OAuthIntegrationProviders.FACEBOOK)
                                                        ? 'm-2 text-success'
                                                        : 'm-2 text-warning'
                                                    }
                                                />
                                            </div>
                                    }
                                    <Card.Body className="text-center">
                                        <FontAwesomeIcon
                                            icon={faFacebook}
                                            className={!disabledProvidersStatus[OAuthIntegrationProviders.FACEBOOK] ? 'text-facebook' : ''}
                                            size="2x"
                                        />
                                        <Card.Text className="mb-0">Facebook</Card.Text>
                                        <Card.Text>{!disabledProvidersStatus[OAuthIntegrationProviders.FACEBOOK] ? '' : '(Coming Soon!)'}</Card.Text>
                                    </Card.Body>
                                </Card>
                            </Col>
                            <Col sm={12} md={6} lg={4} xxl={2} className="mb-3">
                                <Card
                                    className={instagramCardClassNames}
                                    onClick={() => !disabledProvidersStatus[OAuthIntegrationProviders.INSTAGRAM]
                                        && onSocialSyncPress(OAuthIntegrationProviders.INSTAGRAM)}>
                                    {
                                        isInstagramSelected
                                            && <div className="position-absolute top-0 right-0">
                                                <FontAwesomeIcon
                                                    icon={isAdsProviderAuthenticated(user, OAuthIntegrationProviders.INSTAGRAM)
                                                        ? faCheckCircle
                                                        : faExclamationCircle
                                                    }
                                                    className={isAdsProviderAuthenticated(user, OAuthIntegrationProviders.INSTAGRAM)
                                                        ? 'm-2 text-success'
                                                        : 'm-2 text-warning'
                                                    }
                                                />
                                            </div>
                                    }
                                    <Card.Body className="text-center">
                                        <FontAwesomeIcon
                                            className={!disabledProvidersStatus[OAuthIntegrationProviders.INSTAGRAM] ? 'text-instagram' : ''}
                                            icon={faInstagram}
                                            size="2x"
                                        />
                                        <Card.Text className="mb-0">Instagram</Card.Text>
                                        <Card.Text>{!disabledProvidersStatus[OAuthIntegrationProviders.INSTAGRAM] ? '' : '(Coming Soon!)'}</Card.Text>
                                    </Card.Body>
                                </Card>
                            </Col>
                            <Col sm={12} md={6} lg={4} xxl={2} className="mb-3">
                                <Card
                                    className={linkedInCardClassNames}
                                    onClick={() => !disabledProvidersStatus[OAuthIntegrationProviders.LINKEDIN]
                                        && onSocialSyncPress(OAuthIntegrationProviders.LINKEDIN)}>
                                    {
                                        isLinkedInSelected
                                            && <div className="position-absolute top-0 right-0">
                                                <FontAwesomeIcon
                                                    icon={isAdsProviderAuthenticated(user, OAuthIntegrationProviders.LINKEDIN)
                                                        ? faCheckCircle
                                                        : faExclamationCircle
                                                    }
                                                    className={isAdsProviderAuthenticated(user, OAuthIntegrationProviders.LINKEDIN)
                                                        ? 'm-2 text-success'
                                                        : 'm-2 text-warning'
                                                    }
                                                />
                                            </div>
                                    }
                                    <Card.Body className="text-center">
                                        <FontAwesomeIcon
                                            className={!disabledProvidersStatus[OAuthIntegrationProviders.LINKEDIN] ? 'text-linkedin' : ''}
                                            icon={faLinkedin}
                                            size="2x"
                                        />
                                        <Card.Text className="mb-0">LinkedIn</Card.Text>
                                        <Card.Text>{!disabledProvidersStatus[OAuthIntegrationProviders.LINKEDIN] ? '' : '(Coming Soon!)'}</Card.Text>
                                    </Card.Body>
                                </Card>
                            </Col>
                            <Col sm={12} md={6} lg={4} xxl={2} className="mb-3">
                                <Card
                                    className={googleCardClassNames}
                                    onClick={() => !disabledProvidersStatus[OAuthIntegrationProviders.GOOGLE]
                                        && onSocialSyncPress(OAuthIntegrationProviders.GOOGLE)}>
                                    {
                                        isGoogleSelected
                                            && <div className="position-absolute top-0 right-0">
                                                <FontAwesomeIcon
                                                    icon={isAdsProviderAuthenticated(user, OAuthIntegrationProviders.GOOGLE)
                                                        ? faCheckCircle
                                                        : faExclamationCircle
                                                    }
                                                    className={isAdsProviderAuthenticated(user, OAuthIntegrationProviders.GOOGLE)
                                                        ? 'm-2 text-success'
                                                        : 'm-2 text-warning'
                                                    }
                                                />
                                            </div>
                                    }
                                    <Card.Body className="text-center">
                                        <FontAwesomeIcon
                                            className={!disabledProvidersStatus[OAuthIntegrationProviders.GOOGLE] ? 'text-google' : ''}
                                            icon={faGoogle}
                                            size="2x"
                                        />
                                        <Card.Text className="mb-0">Google</Card.Text>
                                        <Card.Text>{!disabledProvidersStatus[OAuthIntegrationProviders.GOOGLE] ? '' : '(Coming Soon!)'}</Card.Text>
                                    </Card.Body>
                                </Card>
                            </Col>
                            <Col sm={12} md={6} lg={4} xxl={2} className="mb-3">
                                <Card
                                    className={twitterCardClassNames}
                                    onClick={() => !disabledProvidersStatus[OAuthIntegrationProviders.TWITTER]
                                        && onSocialSyncPress(OAuthIntegrationProviders.TWITTER)}>
                                    {
                                        isTwitterSelected
                                            && <div className="position-absolute top-0 right-0">
                                                <FontAwesomeIcon
                                                    icon={isAdsProviderAuthenticated(user, OAuthIntegrationProviders.TWITTER)
                                                        ? faCheckCircle
                                                        : faExclamationCircle
                                                    }
                                                    className={isAdsProviderAuthenticated(user, OAuthIntegrationProviders.TWITTER)
                                                        ? 'm-2 text-success'
                                                        : 'm-2 text-warning'
                                                    }
                                                />
                                            </div>
                                    }
                                    <Card.Body className="text-center">
                                        <FontAwesomeIcon
                                            className={!disabledProvidersStatus[OAuthIntegrationProviders.TWITTER] ? 'text-twitter' : ''}
                                            icon={faTwitter}
                                            size="2x"
                                        />
                                        <Card.Text className="mb-0">Twitter</Card.Text>
                                        <Card.Text>{!disabledProvidersStatus[OAuthIntegrationProviders.TWITTER] ? '' : '(Coming Soon!)'}</Card.Text>
                                    </Card.Body>
                                </Card>
                            </Col>
                        </Row>
                        {
                            (isFacebookSelected || isInstagramSelected)
                            && <Row>
                                <Col sm={12}>
                                    <h5 className="my-4">Ad Target Customizations</h5>
                                </Col>
                                {
                                    isFacebookSelected && (fetchedIntegrationDetails[OAuthIntegrationProviders.FACEBOOK]?.account?.data?.length
                                        || fetchedIntegrationDetails[OAuthIntegrationProviders.FACEBOOK]?.adAccount?.data?.length)
                                    && <>
                                        <Col lg={1} className="d-flex justify-content-center align-items-center">
                                            <FontAwesomeIcon
                                                icon={faFacebook}
                                                className={!disabledProvidersStatus[OAuthIntegrationProviders.FACEBOOK] ? 'text-facebook' : ''}
                                                size="2x"
                                            />
                                        </Col>
                                        <Col lg={4} className="mb-3">
                                            <Form.Group controlId="adAccountId">
                                                <Form.Label>Facebook Ad Account</Form.Label>
                                                <Form.Control
                                                    value={inputs.integrationDetails[OAuthIntegrationProviders.FACEBOOK]?.adAccountId}
                                                    name="adAccountId"
                                                    onChange={(e) => onIntegrationDetailsChange(OAuthIntegrationProviders.FACEBOOK, e)}
                                                    as="select"
                                                >
                                                    {
                                                        fetchedIntegrationDetails[OAuthIntegrationProviders.FACEBOOK]?.adAccount?.data.map((accountDetails) => (
                                                            <option key={accountDetails.id} value={accountDetails.id}>{accountDetails.name}</option>
                                                        ))
                                                    }
                                                </Form.Control>
                                            </Form.Group>
                                        </Col>
                                        <Col lg={4} className="mb-3">
                                            <Form.Group controlId="fbPageId">
                                                <Form.Label>Facebook Page for Ad Publishing</Form.Label>
                                                <Form.Control
                                                    value={inputs.integrationDetails[OAuthIntegrationProviders.FACEBOOK]?.pageId}
                                                    name="fbPageId"
                                                    onChange={(e) => onIntegrationDetailsChange(OAuthIntegrationProviders.FACEBOOK, e)}
                                                    as="select"
                                                >
                                                    {
                                                        fetchedIntegrationDetails[OAuthIntegrationProviders.FACEBOOK]?.account?.data.map((pageDetails) => (
                                                            <option key={pageDetails.id} value={pageDetails.id}>{pageDetails.name}</option>
                                                        ))
                                                    }
                                                </Form.Control>
                                            </Form.Group>
                                        </Col>
                                        <Col lg={3} className="mb-3">
                                            <Form.Group controlId="maxBudget">
                                                <Form.Label>Facebook Integration Max Budget</Form.Label>
                                                <Form.Control
                                                    value={inputs.integrationDetails[OAuthIntegrationProviders.FACEBOOK]?.maxBudget || 100}
                                                    name="maxBudget"
                                                    onChange={(e) => onIntegrationDetailsChange(OAuthIntegrationProviders.FACEBOOK, e)}
                                                    type="number"
                                                    required
                                                    placeholder="100.00"
                                                    step="1"
                                                />
                                            </Form.Group>
                                        </Col>
                                    </>
                                }
                                {
                                    isInstagramSelected && (fetchedIntegrationDetails[OAuthIntegrationProviders.FACEBOOK]?.account?.data?.length
                                        || fetchedIntegrationDetails[OAuthIntegrationProviders.FACEBOOK]?.adAccount?.data?.length)
                                    && <>
                                        <Col lg={1} className="d-flex justify-content-center align-items-center">
                                            <FontAwesomeIcon
                                                icon={faInstagram}
                                                className={!disabledProvidersStatus[OAuthIntegrationProviders.INSTAGRAM] ? 'text-instagram' : ''}
                                                size="2x"
                                            />
                                        </Col>
                                        <Col lg={4} className="mb-3">
                                            <Form.Group controlId="adAccountId">
                                                <Form.Label>Facebook Ad Account (*required for IG Ads)</Form.Label>
                                                <Form.Control
                                                    value={inputs.integrationDetails[OAuthIntegrationProviders.FACEBOOK]?.adAccountId}
                                                    name="adAccountId"
                                                    onChange={(e) => onIntegrationDetailsChange(OAuthIntegrationProviders.FACEBOOK, e)}
                                                    as="select"
                                                >
                                                    {
                                                        fetchedIntegrationDetails[OAuthIntegrationProviders.FACEBOOK]?.adAccount?.data.map((accountDetails) => (
                                                            <option key={accountDetails.id} value={accountDetails.id}>{accountDetails.name}</option>
                                                        ))
                                                    }
                                                </Form.Control>
                                            </Form.Group>
                                        </Col>
                                        <Col lg={4} className="mb-3">
                                            <Form.Group controlId="fbPageId">
                                                <Form.Label>Facebook Page for Ad Publishing (*required for IG Ads)</Form.Label>
                                                <Form.Control
                                                    value={inputs.integrationDetails[OAuthIntegrationProviders.FACEBOOK]?.pageId}
                                                    name="fbPageId"
                                                    onChange={(e) => onIntegrationDetailsChange(OAuthIntegrationProviders.FACEBOOK, e)}
                                                    as="select"
                                                >
                                                    {
                                                        fetchedIntegrationDetails[OAuthIntegrationProviders.FACEBOOK]?.account?.data.map((pageDetails) => (
                                                            <option key={pageDetails.id} value={pageDetails.id}>{pageDetails.name}</option>
                                                        ))
                                                    }
                                                </Form.Control>
                                            </Form.Group>
                                        </Col>
                                        <Col lg={3} className="mb-3">
                                            <Form.Group controlId="igPageId">
                                                <Form.Label>Instagram Page for Ad Publishing</Form.Label>
                                                <Form.Control
                                                    value={inputs.integrationDetails[OAuthIntegrationProviders.INSTAGRAM]?.pageId}
                                                    name="igPageId"
                                                    onChange={(e) => onIntegrationDetailsChange(OAuthIntegrationProviders.INSTAGRAM, e)}
                                                    as="select"
                                                >
                                                    {
                                                        fetchedIntegrationDetails[OAuthIntegrationProviders.INSTAGRAM]?.igAccount?.data.map((pageDetails) => (
                                                            <option key={pageDetails.id} value={pageDetails.id}>{pageDetails.username}</option>
                                                        ))
                                                    }
                                                </Form.Control>
                                            </Form.Group>
                                        </Col>
                                    </>
                                }
                            </Row>
                        }
                        <Row>
                            <h5 className="my-4">Ad Target Locations</h5>
                            {
                                inputs.type === CampaignTypes.LOCAL
                                && <Col md={4} className="mb-3">
                                    {
                                        mySpaces.length < 1
                                            ? <Form.Group controlId="spaceId">
                                                <div className="text-center">
                                                    <Form.Label className="text-center">* Local Campaigns Require a Business Space</Form.Label>
                                                </div>
                                                <div className="text-center">
                                                    <Button variant="secondary" onClick={navigateHandler('/claim-a-space')}>
                                                        <FontAwesomeIcon icon={faMapMarked} className="me-1" /> Claim a Space
                                                    </Button>
                                                </div>
                                            </Form.Group>
                                            : <Form.Group controlId="spaceId">
                                                <Form.Label>Business Space</Form.Label>
                                                <Form.Control
                                                    value={inputs.spaceId}
                                                    name="spaceId"
                                                    onChange={onInputChange}
                                                    as="select"
                                                >
                                                    {
                                                        mySpaces.map((space) => (
                                                            <option key={space.id} value={space.id}>{space.notificationMsg}</option>
                                                        ))
                                                    }
                                                </Form.Control>
                                            </Form.Group>
                                    }
                                </Col>
                            }
                            <Col md={inputs.type === CampaignTypes.LOCAL ? 8 : 12} className="mb-3">
                                {/* <Form.Group id="address">
                                    <Form.Label>Address</Form.Label>
                                    <InputGroup className="input-group-merge search-bar">
                                        <InputGroup.Text><FontAwesomeIcon icon={faSearch} /></InputGroup.Text>
                                        <Form.Control required type="text" placeholder="Search an address..." />
                                    </InputGroup>
                                </Form.Group> */}
                                <Form.Group controlId="address">
                                    <Form.Label>Target Locations</Form.Label>
                                    <Typeahead
                                        id="address-search-typeahead"
                                        options={addressTypeAheadResults.map((result) => ({
                                            ...result,
                                            label: result.description || '',
                                        }))}
                                        placeholder="Search an address or location..."
                                        onInputChange={onAddressTypeaheadChange}
                                        onChange={onAddressTypeAheadSelect}
                                        selected={inputs.address}
                                    />
                                </Form.Group>
                                <Row className="mt-2">
                                    {
                                        inputs.targetLocations.map((location) => (
                                            <Col
                                                sm={12}
                                                md={6}
                                                lg={3}
                                                key={location.latitude}
                                            >
                                                <Col
                                                    className="card border-light shadow-sm me-1 pe-1 d-flex flex-row align-items-center justify-content-between"
                                                >
                                                    {location.label}
                                                    <FontAwesomeIcon onClick={() => onRemoveTargetLocation(location.label)} icon={faTimesCircle} className="pointer me-1" />
                                                </Col>
                                            </Col>
                                        ))
                                    }
                                </Row>
                            </Col>
                        </Row>
                        <div className="mt-3 d-flex justify-content-end">
                            <Button
                                variant="primary"
                                type="submit"
                                onClick={onSubmit}
                                onSubmit={onSubmit}
                                disabled={isSubmitDisabled}
                            >{hasFormChanged ? 'Save' : 'Next'}</Button>
                        </div>
                    </Form>
                }
                {
                    formStage === 2
                    && <Form>
                        <Row>
                            <Col sm={4}>
                                <h5 className="my-4">Edit Ad Set Grouping</h5>
                                <Col md={12} className="mb-3">
                                    <Form.Group controlId="adGroupHeadline">
                                        <Form.Label className="required" aria-required>Ad Group Title</Form.Label>
                                        <Form.Control
                                            value={inputs.adGroup.headline}
                                            name="adGroupHeadline"
                                            onChange={onInputChange}
                                            type="text"
                                            placeholder="A title for your ad group"
                                            required
                                            aria-required
                                            maxLength={40}
                                        />
                                    </Form.Group>
                                </Col>
                                <Col md={12} className="mb-3">
                                    <Form.Group controlId="adGroupDescription">
                                        <Form.Label className="required" aria-required>Ad Group Description</Form.Label>
                                        <Form.Control
                                            as="textarea"
                                            value={inputs.adGroup.description}
                                            name="adGroupDescription"
                                            onChange={onInputChange}
                                            type="text"
                                            placeholder="A description for your ad group"
                                            required
                                            aria-required
                                            maxLength={160}
                                        />
                                    </Form.Group>
                                </Col>
                                <h5 className="my-4">Assets (images/media/etc)</h5>
                                <Row>
                                    <Col sm={12} className="d-flex align-items-center justify-content-center">
                                        <Dropzone
                                            dropZoneText={'Click here to upload image(s) for this campaign or drag and drop files'}
                                            initialFileUrl={mediaUrl}
                                            onMediaSelect={onSelectMedia}
                                            multiple
                                            disabled={mediaAssets.length > 4}
                                        />
                                    </Col>
                                </Row>
                                <Row>
                                    <Col sm={12} className="d-flex align-items-center justify-content-center">
                                        <Row>
                                            {
                                                mediaAssets.map((asset) => (
                                                    <Col key={asset.id} xs="6" sm="12" md="6" className="my-2">
                                                        <div className="image-preview-container">
                                                            <FontAwesomeIcon
                                                                icon={faTimesCircle}
                                                                className="text-danger remove-image"
                                                                size="1x"
                                                                onClick={() => removeMediaAsset(asset.id)}
                                                            />
                                                            <img src={getUserContentUri(asset.media)} className="rounded" alt="" />
                                                        </div>
                                                    </Col>
                                                ))
                                            }
                                        </Row>
                                    </Col>
                                </Row>
                            </Col>
                            <Col sm={8}>
                                {
                                    (inputs.adGroup.assets || []).filter((a) => a.type === CampaignAssetTypes.COMBINED).map((asset, index) => (
                                        <React.Fragment key={index}>
                                            <Row>
                                                <h5 className="my-4">Create/Edit Ads</h5>
                                                <Col md={12} className="mb-3">
                                                    <Form.Group controlId={`headline${index + 1}`}>
                                                        <Form.Label className="required" aria-required>Headline {index + 1}</Form.Label>
                                                        <Form.Control
                                                            value={inputs.adGroup?.assets[index].headline}
                                                            name={`headline${index + 1}`}
                                                            onChange={(e) => onAssetInputChange(e, index, 'headline', e.currentTarget.value)}
                                                            type="text"
                                                            placeholder="An ad headline"
                                                            required
                                                            aria-required
                                                            maxLength={40}
                                                        />
                                                    </Form.Group>
                                                </Col>
                                                <Col md={12} className="mb-3">
                                                    <Form.Group controlId={`link${index + 1}`}>
                                                        <Form.Label className="required" aria-required>Link {index + 1}</Form.Label>
                                                        <Form.Control
                                                            value={inputs.adGroup?.assets[index].linkUrl}
                                                            name={`link${index + 1}`}
                                                            onChange={(e) => onAssetInputChange(e, index, 'linkUrl', e.currentTarget.value)}
                                                            placeholder="https://www.example.com"
                                                            required
                                                            aria-required
                                                            maxLength={40}
                                                            type="url"
                                                            pattern="https://.*"
                                                        />
                                                    </Form.Group>
                                                </Col>
                                                <Col md={12} className="mb-3">
                                                    <Form.Group controlId={`longText${index + 1}`}>
                                                        <Form.Label className="required" aria-required>Description {index + 1} (optional)</Form.Label>
                                                        <Form.Control
                                                            as="textarea"
                                                            value={inputs.adGroup?.assets[index].longText}
                                                            name={`longText${index + 1}`}
                                                            onChange={(e) => onAssetInputChange(e, index, 'longText', e.currentTarget.value)}
                                                            type="text"
                                                            placeholder="An alternate description"
                                                            required
                                                            aria-required
                                                            maxLength={100}
                                                        />
                                                    </Form.Group>
                                                </Col>
                                            </Row>
                                            <hr />
                                        </React.Fragment>
                                    ))
                                }
                                {/* <Row className="text-center align-items-center justify-content-center">
                                    <Col md={12} lg={2} className="mb-3">
                                        <Row>
                                            <Button
                                                variant="primary"
                                                type="button"
                                                onClick={() => { console.log('foo'); }}
                                                onSubmit={() => { console.log('foo'); }}
                                                // disabled={isSubmitDisabled}
                                            >
                                                <FontAwesomeIcon icon={faPlusCircle} className="me-0" />
                                            </Button>
                                        </Row>
                                    </Col>
                                </Row> */}
                            </Col>
                        </Row>
                        <div className="mt-3 d-flex justify-content-end">
                            <Button
                                variant="secondary"
                                type="submit"
                                onClick={goBack}
                                className="mx-3"
                            >{'Back'}</Button>
                            <Button
                                variant="primary"
                                type="submit"
                                onClick={onSubmit}
                                onSubmit={onSubmit}
                                disabled={isSubmitDisabled}
                            >{hasFormChanged ? 'Save' : 'Continue'}</Button>
                        </div>
                    </Form>
                }
            </Card.Body>
        </Card>
    );
};

export default EditCampaignForm;
