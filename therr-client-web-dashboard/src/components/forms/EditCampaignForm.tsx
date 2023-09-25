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
import { ICampaignAsset } from '../../types';
import getUserContentUri from '../../utilities/getUserContentUri';

const adTypeCategories = [
    'local',
    'awareness',
    'acquisition',
    'engagement',
];

interface IEditCampaignFormProps {
    formStage: number;
    addressTypeAheadResults: any[],
    hasFormChanged: boolean;
    goBack: (event: React.MouseEvent<HTMLButtonElement>) => void;
    inputs: {
        title: string;
        description: string;
        type: string;
        scheduleStartAt: string;
        scheduleStopAt: string;
        address?: Option[];
        category?: string;
        phoneNumber?: string;
        websiteUrl?: string;
        menuUrl?: string;
        orderUrl?: string;
        reservationUrl?: string;
        headline1: string;
        headline2: string;
        longText1: string;
        longText2: string;
    }
    isSubmitDisabled: boolean;
    mediaUrl?: string;
    mediaAssets: ICampaignAsset[] ;
    onAddressTypeaheadChange: (text: string, event: React.ChangeEvent<HTMLInputElement>) => void,
    onAddressTypeAheadSelect: (selected: Option[]) => void;
    onInputChange: React.ChangeEventHandler<HTMLInputElement>;
    onDateTimeChange: (name: string, value: string | Moment) => void;
    onSubmit: (event: React.MouseEvent<HTMLButtonElement>) => void;
    onSelectMedia: (files: any[]) => any;
    shouldShowAdvancedFields?: boolean;
}

const EditCampaignForm = ({
    addressTypeAheadResults,
    formStage,
    goBack,
    mediaUrl,
    mediaAssets,
    hasFormChanged,
    inputs,
    isSubmitDisabled,
    onAddressTypeAheadSelect,
    onAddressTypeaheadChange,
    onInputChange,
    onDateTimeChange,
    onSubmit,
    onSelectMedia,
    shouldShowAdvancedFields,
}: IEditCampaignFormProps) => {
    const [birthday, setBirthday] = useState('');

    return (
        <Card border="light" className="bg-white shadow-sm mb-4">
            <Card.Body>
                {
                    formStage === 1
                    && <Form>
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
                            </Col>
                            <Col sm={4}>
                                <h5 className="my-4">Campaign Schedule</h5>
                                <Row className="align-items-center">
                                    <Col md={12} className="mb-3">
                                        <Form.Group id="scheduleStartAt">
                                            <Form.Label>Start Date/Time</Form.Label>
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
                                </Row>
                                <Row className="align-items-center">
                                    <Col md={12} className="mb-3">
                                        <Form.Group id="scheduleStopAt">
                                            <Form.Label>End Date/Time</Form.Label>
                                            <Datetime
                                                timeFormat={true}
                                                onChange={(value) => onDateTimeChange('scheduleStopAt', value)}
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
                                                        <img src={getUserContentUri(asset.media)} className="rounded" alt="" />
                                                    </Col>
                                                ))
                                            }
                                        </Row>
                                    </Col>
                                </Row>
                            </Col>
                            <Col sm={8}>
                                <Row>
                                    <h5 className="my-4">Edit Headlines</h5>
                                    <Col md={12} className="mb-3">
                                        <Form.Group controlId="headline1">
                                            <Form.Label className="required" aria-required>Headline 1</Form.Label>
                                            <Form.Control
                                                value={inputs.headline1}
                                                name="headline1"
                                                onChange={onInputChange}
                                                type="text"
                                                placeholder="A headline for your ad"
                                                required
                                                aria-required
                                                maxLength={160}
                                            />
                                        </Form.Group>
                                    </Col>
                                    <Col md={12} className="mb-3">
                                        <Form.Group controlId="headline2">
                                            <Form.Label className="required" aria-required>Headline 2</Form.Label>
                                            <Form.Control
                                                value={inputs.headline2}
                                                name="headline2"
                                                onChange={onInputChange}
                                                type="text"
                                                placeholder="Another headline for your ad"
                                                required
                                                aria-required
                                                maxLength={40}
                                            />
                                        </Form.Group>
                                    </Col>
                                    <Col md={12} className="mb-3">
                                        <Form.Group controlId="longText1">
                                            <Form.Label className="required" aria-required>Description 1</Form.Label>
                                            <Form.Control
                                                as="textarea"
                                                value={inputs.longText1}
                                                name="longText1"
                                                onChange={onInputChange}
                                                type="text"
                                                placeholder="A description with more details"
                                                required
                                                aria-required
                                                maxLength={100}
                                            />
                                        </Form.Group>
                                    </Col>
                                    <Col md={12} className="mb-3">
                                        <Form.Group controlId="longText2">
                                            <Form.Label className="required" aria-required>Description 2 (optional)</Form.Label>
                                            <Form.Control
                                                as="textarea"
                                                value={inputs.longText2}
                                                name="longText2"
                                                onChange={onInputChange}
                                                type="text"
                                                placeholder="An alternate description"
                                                required
                                                aria-required
                                                maxLength={100}
                                            />
                                        </Form.Group>
                                    </Col>
                                </Row>
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
