import React, { useState } from 'react';
import {
    Col, Row, Card, Form, Button,
} from 'react-bootstrap';
import { Typeahead } from 'react-bootstrap-typeahead';
import { Option } from 'react-bootstrap-typeahead/types/types';

const spaceCategories = [
    'uncategorized',
    'menu',
    'deals',
    'storefront',
    'idea',
    'food',
    'music',
    'nature',
];

interface IEditSpaceFormProps {
    addressTypeAheadResults: any[],
    inputs: {
        address?: Option[];
        category?: string;
        spaceTitle: string;
        spaceDescription: string;
    }
    isSubmitDisabled: boolean;
    onAddressTypeaheadChange: (text: string, event: React.ChangeEvent<HTMLInputElement>) => void,
    onAddressTypeaheadSelect: (selected: Option[]) => void;
    onInputChange: React.ChangeEventHandler<HTMLInputElement>;
    onSubmit: (event: React.MouseEvent<HTMLInputElement>) => void;
    submitText: string;
}

const EditSpaceForm = ({
    addressTypeAheadResults,
    inputs,
    isSubmitDisabled,
    onAddressTypeaheadSelect,
    onAddressTypeaheadChange,
    onInputChange,
    onSubmit,
    submitText,
}: IEditSpaceFormProps) => {
    const [birthday, setBirthday] = useState('');

    return (
        <Card border="light" className="bg-white shadow-sm mb-4">
            <Card.Body>
                <Form>
                    <h5 className="my-4">Location / Address</h5>
                    <Row>
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
                                    onChange={onAddressTypeaheadSelect}
                                    selected={inputs.address}
                                />
                            </Form.Group>
                        </Col>
                    </Row>
                    <h5 className="my-4">General Information</h5>
                    <Row>
                        <Col md={6} className="mb-3">
                            <Form.Group controlId="spaceTitle">
                                <Form.Label>Space Title / Headline</Form.Label>
                                <Form.Control
                                    value={inputs.spaceTitle}
                                    name="spaceTitle"
                                    onChange={onInputChange}
                                    required
                                    type="text"
                                    placeholder="The name or title of your space/business"
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
                            <Form.Group id="emal">
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
