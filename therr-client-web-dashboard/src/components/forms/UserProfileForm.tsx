import React, { useState } from 'react';
import {
    Col, Row, Card, Form, Button,
} from 'react-bootstrap';
import PhoneInput, { isValidPhoneNumber } from 'react-phone-number-input';
import flags from 'react-phone-number-input/flags'; // eslint-disable-line import/extensions

interface IUserProfileFormProps {
    userName: string;
    firstName: string;
    lastName: string;
    email: string;
    phoneNumber: string;
    onPhoneInputChange: any;
    isPhoneNumberValid?: boolean;
    translate: any;
}

const UserProfileForm = ({
    userName,
    firstName,
    lastName,
    email,
    phoneNumber,
    onPhoneInputChange,
    isPhoneNumberValid,
    translate,
}: IUserProfileFormProps) => {
    const [birthday, setBirthday] = useState('');

    return (
        <Card border="light" className="bg-white shadow-sm mb-4">
            <Card.Body>
                <h5 className="mb-4">Complete Your Profile</h5>
                <p className="mb-4 text-center">Add you phone number below to begin verification (MFA).
                    This prevents bots and improves security for everyone using the platform.</p>
                <Form>
                    <Row>
                        <Col md={6} className="mb-3">
                            <Form.Group id="firstName">
                                <Form.Label>First Name (optional)</Form.Label>
                                <Form.Control value={firstName} type="text" placeholder="Your first name..." />
                            </Form.Group>
                        </Col>
                        <Col md={6} className="mb-3">
                            <Form.Group id="lastName">
                                <Form.Label>Last Name (optional)</Form.Label>
                                <Form.Control value={lastName} type="text" placeholder="Your last name..." />
                            </Form.Group>
                        </Col>
                    </Row>
                    <Row>
                        <Col md={12} className="mb-3">
                            <Form.Group id="userName">
                                <Form.Label>Username (required)</Form.Label>
                                <Form.Control value={userName} required type="text" placeholder="Create a username..." />
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
                    <Row>
                        <Col md={6} className="mb-3">
                            <Form.Group id="email">
                                <Form.Label>Email</Form.Label>
                                <Form.Control value={email} required type="email" placeholder="name@company.com" disabled />
                            </Form.Group>
                        </Col>
                        <Col md={6} className="mb-3">
                            <Form.Group id="phone">
                                <Form.Label>Phone (required)</Form.Label>
                                <PhoneInput
                                    id="phone"
                                    defaultCountry="US"
                                    country="US"
                                    international={true}
                                    flags={flags}
                                    value={phoneNumber}
                                    onChange={onPhoneInputChange}
                                    required
                                />
                                {
                                    !isPhoneNumberValid
                                        && <div className="validation-errors">
                                            <div className="message-container icon-small attention-alert">
                                                <em className="message">
                                                    {translate('components.createProfileForm.validationErrors.phoneNumber')}
                                                </em>
                                            </div>
                                        </div>
                                }
                            </Form.Group>
                        </Col>
                    </Row>
                    <div className="mt-3 text-right">
                        <Button variant="primary" type="submit">Continue</Button>
                    </div>
                </Form>
            </Card.Body>
        </Card>
    );
};

export default UserProfileForm;
