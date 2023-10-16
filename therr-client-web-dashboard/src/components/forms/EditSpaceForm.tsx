import React, { useState } from 'react';
import {
    Col, Row, Card, Form, Button, Image,
} from 'react-bootstrap';
import { Typeahead } from 'react-bootstrap-typeahead';
import { Option } from 'react-bootstrap-typeahead/types/types';
import Dropzone from './Dropzone';

const spaceCategories = [
    'uncategorized',
    'restaurant/food',
    'music/concerts',
    'storefront/shop',
    'artwork/expression',
    'hotels/lodging',
    'bar/drinks',
    'marketplace/festival',
    'nature/parks',
    'event/space',
];

interface IEditSpaceFormProps {
    addressTypeAheadResults: any[],
    inputs: {
        address?: Option[];
        category?: string;
        spaceTitle: string;
        spaceDescription: string;
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
    onSubmit: (event: React.MouseEvent<HTMLInputElement>) => void;
    onSelectMedia?: (files: any[]) => any;
    submitText: string;
    shouldShowAdvancedFields?: boolean;
}

const EditSpaceForm = ({
    addressTypeAheadResults,
    mediaUrl,
    inputs,
    isSubmitDisabled,
    onAddressTypeAheadSelect,
    onAddressTypeaheadChange,
    onInputChange,
    onSubmit,
    onSelectMedia,
    submitText,
    shouldShowAdvancedFields,
}: IEditSpaceFormProps) => {
    const [birthday, setBirthday] = useState('');

    return (
        <Card border="light" className="bg-white shadow-sm mb-4">
            <Card.Body>
                <Form>
                    <Row>
                        <h5 className="my-4">Location / Address</h5>
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
                                    placeholder="Search an address..."
                                    onInputChange={onAddressTypeaheadChange}
                                    onChange={onAddressTypeAheadSelect}
                                    selected={inputs.address}
                                />
                            </Form.Group>
                        </Col>
                    </Row>
                    <Row>
                        {
                            onSelectMedia
                            && <Col sm={4}>
                                <h5 className="my-4">Images</h5>
                                <Col sm={12} className="d-flex align-items-center justify-content-center">
                                    <Dropzone
                                        dropZoneText={'Click here to upload image(s) for this space or drag and drop files'}
                                        initialFileUrl={mediaUrl}
                                        onMediaSelect={onSelectMedia}
                                    />
                                </Col>
                            </Col>
                        }
                        <Col sm={onSelectMedia ? 8 : 12}>
                            <h5 className="my-4">General Information</h5>
                            <Row>
                                <Col md={6} className="mb-3">
                                    <Form.Group controlId="spaceTitle">
                                        <Form.Label className="required" aria-required>Space Title / Headline</Form.Label>
                                        <Form.Control
                                            value={inputs.spaceTitle}
                                            name="spaceTitle"
                                            onChange={onInputChange}
                                            type="text"
                                            placeholder="The name or title of your space/business"
                                            required
                                            aria-required
                                        />
                                    </Form.Group>
                                </Col>
                                <Col md={6} className="mb-3">
                                    <Form.Group controlId="category">
                                        <Form.Label>Category</Form.Label>
                                        <Form.Control
                                            value={inputs.category}
                                            name="category"
                                            onChange={onInputChange}
                                            as="select"
                                        >
                                            {
                                                spaceCategories.map((cat, index) => (
                                                    <option key={index} value={cat}>{cat}</option>
                                                ))
                                            }
                                        </Form.Control>
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
                            <Row>
                                <Col md={12} className="mb-3">
                                    <Form.Group controlId="spaceDescription">
                                        <Form.Label>Description</Form.Label>
                                        <Form.Control
                                            value={inputs.spaceDescription}
                                            as="textarea"
                                            required
                                            type="text"
                                            name="spaceDescription"
                                            onChange={onInputChange}
                                            placeholder="Add a description of the space and what makes it unique..."
                                            maxLength={1000}
                                        />
                                    </Form.Group>
                                </Col>
                            </Row>
                        </Col>
                    </Row>
                    {/* <Row className="align-items-center">
                        <Col md={6} className="mb-3">
                            <Form.Group id="birthday">
                                <Form.Label>Birthday</Form.Label>
                                <Datetime
                                    timeFormat={false}
                                    onChange={(value) => setBirthday(value.toString())}
                                    renderInput={(props, openCalendar) => (
                                        <InputGroup>
                                            <InputGroup.Text><FontAwesomeIcon icon={faCalendarAlt} /></InputGroup.Text>
                                            <Form.Control
                                                required
                                                type="text"
                                                value={birthday ? moment(birthday).format('MM/DD/YYYY') : ''}
                                                placeholder="mm/dd/yyyy"
                                                onFocus={() => openCalendar()}
                                                onChange={() => {}} />
                                        </InputGroup>
                                    )} />
                            </Form.Group>
                        </Col>
                        <Col md={6} className="mb-3">
                            <Form.Group id="gender">
                                <Form.Label>Gender</Form.Label>
                                <Form.Select defaultValue="0">
                                    <option value="0">Gender</option>
                                    <option value="1">Female</option>
                                    <option value="2">Male</option>
                                </Form.Select>
                            </Form.Group>
                        </Col>
                    </Row> */}
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

export default EditSpaceForm;
