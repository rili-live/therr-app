import React, { useState } from 'react';
import {
    Col, Row, Card, Form, Button, Image, InputGroup,
} from 'react-bootstrap';
import { Typeahead } from 'react-bootstrap-typeahead';
import { Option } from 'react-bootstrap-typeahead/types/types';
import Datetime from 'react-datetime';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCalendarAlt } from '@fortawesome/free-solid-svg-icons';
import moment, { Moment } from 'moment';
import Dropzone from './Dropzone';

const adTypeCategories = [
    'local',
    'awareness',
    'acquisition',
    'engagement',
];

interface IEditCampaignFormProps {
    addressTypeAheadResults: any[],
    inputs: {
        title: string;
        description: string;
        type: string;
        scheduleStartAt: string;
        scheduleEndAt: string;
        address?: Option[];
        category?: string;
        phoneNumber?: string;
        websiteUrl?: string;
        menuUrl?: string;
        orderUrl?: string;
        reservationUrl?: string;
    }
    isSubmitDisabled: boolean;
    mediaUrl?: string;
    onAddressTypeaheadChange: (text: string, event: React.ChangeEvent<HTMLInputElement>) => void,
    onAddressTypeAheadSelect: (selected: Option[]) => void;
    onInputChange: React.ChangeEventHandler<HTMLInputElement>;
    onDateTimeChange: (name: string, value: string | Moment) => void;
    onSubmit: (event: React.MouseEvent<HTMLInputElement>) => void;
    onSelectMedia: (files: any[]) => any;
    submitText: string;
    shouldShowAdvancedFields?: boolean;
}

const EditCampaignForm = ({
    addressTypeAheadResults,
    mediaUrl,
    inputs,
    isSubmitDisabled,
    onAddressTypeAheadSelect,
    onAddressTypeaheadChange,
    onInputChange,
    onDateTimeChange,
    onSubmit,
    onSelectMedia,
    submitText,
    shouldShowAdvancedFields,
}: IEditCampaignFormProps) => {
    const [birthday, setBirthday] = useState('');

    return (
        <Card border="light" className="bg-white shadow-sm mb-4">
            <Card.Body>
                <Form>
                    <Row>
                        <Col sm={8}>
                            <h5 className="my-4">General Campaign Information</h5>
                            <Row>
                                <Col md={6} className="mb-3">
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
                                <Col md={6} className="mb-3">
                                    <Form.Group controlId="type">
                                        <Form.Label>Ad Type</Form.Label>
                                        <Form.Control
                                            value={inputs.type}
                                            name="type"
                                            onChange={onInputChange}
                                            as="select"
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
                                <Col md={12} className="mb-3">
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
                                        />
                                    </Form.Group>
                                </Col>
                            </Row>
                            {
                                shouldShowAdvancedFields
                                && <Row>
                                    <Col md={6} className="mb-3">
                                        <Form.Group controlId="websiteUrl">
                                            <Form.Label>Website URL (optional)</Form.Label>
                                            <Form.Control
                                                value={inputs.websiteUrl}
                                                name="websiteUrl"
                                                onChange={onInputChange}
                                                required
                                                type="url"
                                                placeholder="ex.) https://my-restaurant.com/"
                                            />
                                        </Form.Group>
                                    </Col>
                                    <Col md={6} className="mb-3">
                                        <Form.Group controlId="orderUrl">
                                            <Form.Label>Delivery/Pickup URL (optional)</Form.Label>
                                            <Form.Control
                                                value={inputs.orderUrl}
                                                name="orderUrl"
                                                onChange={onInputChange}
                                                required
                                                type="url"
                                                placeholder="ex.) https://my-restaurant.com/delivery/"
                                            />
                                        </Form.Group>
                                    </Col>
                                </Row>
                            }
                        </Col>
                        <Col sm={4}>
                            <h5 className="my-4">Assets (images/media)</h5>
                            <Col sm={12} className="d-flex align-items-center justify-content-center">
                                <Dropzone
                                    dropZoneText={'Click here to upload image(s) for this space or drag and drop files'}
                                    initialFileUrl={mediaUrl}
                                    onMediaSelect={onSelectMedia}
                                />
                            </Col>
                        </Col>
                    </Row>
                    <Row className="align-items-center">
                        <Col md={6} className="mb-3">
                            <Form.Group id="scheduleStartAt">
                                <Form.Label>Campaign Start Date/Time</Form.Label>
                                <Datetime
                                    timeFormat={true}
                                    onChange={(value) => onDateTimeChange('scheduleStartAt', value)}
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
                        <Col md={6} className="mb-3">
                            <Form.Group id="scheduleEndAt">
                                <Form.Label>Campaign End Date/Time</Form.Label>
                                <Datetime
                                    timeFormat={true}
                                    onChange={(value) => onDateTimeChange('scheduleEndAt', value)}
                                    renderInput={(props, openCalendar) => (
                                        <InputGroup>
                                            <InputGroup.Text><FontAwesomeIcon icon={faCalendarAlt} /></InputGroup.Text>
                                            <Form.Control
                                                required
                                                type="text"
                                                value={inputs.scheduleEndAt ? moment(inputs.scheduleEndAt).format('MM/DD/YYYY h:mm A') : ''}
                                                placeholder="mm/dd/yyyy"
                                                onFocus={() => openCalendar()}
                                                onChange={() => null}
                                            />
                                        </InputGroup>
                                    )} />
                            </Form.Group>
                        </Col>
                    </Row>
                    <Row>
                        <h5 className="my-4">Ad Target Location / Address</h5>
                        <Col sm={12} className="mb-3">
                            {/* <Form.Group id="address">
                                <Form.Label>Address</Form.Label>
                                <InputGroup className="input-group-merge search-bar">
                                    <InputGroup.Text><FontAwesomeIcon icon={faSearch} /></InputGroup.Text>
                                    <Form.Control required type="text" placeholder="Search an address..." />
                                </InputGroup>
                            </Form.Group> */}
                            <Form.Group controlId="address">
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
                        </Col>
                    </Row>
                    {/* <Row>
                        <Col md={6} className="mb-3">
                            <Form.Group id="email">
                                <Form.Label>Email</Form.Label>
                                <Form.Control required type="email" placeholder="name@company.com" />
                            </Form.Group>
                        </Col>
                        <Col md={6} className="mb-3">
                            <Form.Group id="phone">
                                <Form.Label>Phone</Form.Label>
                                <Form.Control required type="string" placeholder="+12-345 678 910" />
                            </Form.Group>
                        </Col>
                    </Row> */}
                    <div className="mt-3 d-flex justify-content-end">
                        <Button
                            variant="primary"
                            type="submit"
                            onClick={onSubmit}
                            onSubmit={onSubmit}
                            disabled={isSubmitDisabled}
                        >{submitText}</Button>
                    </div>
                </Form>
            </Card.Body>
        </Card>
    );
};

export default EditCampaignForm;
