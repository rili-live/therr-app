import React, { useState } from 'react';
import {
    Col, Row, Card, Form, Button,
} from 'react-bootstrap';
import PhoneInput, { isValidPhoneNumber } from 'react-phone-number-input';
import flags from 'react-phone-number-input/flags'; // eslint-disable-line import/extensions
import { IUserState } from 'therr-react/types';

export const orgTypeOptions = [
    {
        label: 'Storefront / Restaurant',
        value: 'storefront-restaurant',
    },
    {
        label: 'Storefront Franchise',
        value: 'storefront-franchise',
    },
    {
        label: 'Digital Retail',
        value: 'digital-retail',
    },
    {
        label: 'Internet Service',
        value: 'internet-service',
    },
    {
        label: 'Other',
        value: 'other',
    },
];

interface IUserProfileFormProps {
    userName: string;
    firstName: string;
    lastName: string;
    email: string;
    organizationName: string;
    organizationType: string;
    phoneNumber: string;
    onPhoneInputChange: any;
    onSubmit: any;
    onInputChange: any;
    isPhoneNumberValid?: boolean;
    isSubmitting?: boolean;
    translate: any;
    user: IUserState;
}

const UserProfileForm = ({
    userName,
    firstName,
    lastName,
    email,
    organizationName,
    organizationType,
    phoneNumber,
    onPhoneInputChange,
    onInputChange,
    onSubmit,
    isPhoneNumberValid,
    isSubmitting,
    translate,
    user,
}: IUserProfileFormProps) => {
    const onContinue = (e) => {
        e.preventDefault();

        return onSubmit({
            firstName,
            lastName,
            userName,
            organization: {
                name: organizationName,
                settingsGeneralBusinessType: organizationType,
            },
        });
    };

    const isFormDisabled = isSubmitting
        || !isPhoneNumberValid
        || !firstName
        || !lastName
        || !userName
        || (!user.details?.userOrganizations?.length && (!organizationName || !organizationType));

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
                                <Form.Label>First Name (required)</Form.Label>
                                <Form.Control
                                    required
                                    value={firstName}
                                    name="firstName"
                                    type="text"
                                    placeholder="Your first name..."
                                    onChange={onInputChange}
                                />
                            </Form.Group>
                        </Col>
                        <Col md={6} className="mb-3">
                            <Form.Group id="lastName">
                                <Form.Label>Last Name (required)</Form.Label>
                                <Form.Control
                                    required
                                    value={lastName}
                                    name="lastName"
                                    type="text"
                                    placeholder="Your last name..."
                                    onChange={onInputChange}
                                />
                            </Form.Group>
                        </Col>
                    </Row>
                    <Row>
                        <Col md={12} className="mb-3">
                            <Form.Group id="userName">
                                <Form.Label>Username (required)</Form.Label>
                                <Form.Control
                                    value={userName}
                                    name="userName"
                                    required
                                    type="text"
                                    placeholder="Create a username..."
                                    onChange={onInputChange}
                                />
                            </Form.Group>
                        </Col>
                    </Row>
                    {
                        !user.details?.userOrganizations?.length
                        && <>
                            <Row>
                                <Col md={12} className="mb-3">
                                    <Form.Group id="organizationName">
                                        <Form.Label>Business/Organization (required)</Form.Label>
                                        <Form.Control
                                            value={organizationName}
                                            name="organizationName"
                                            required type="text"
                                            placeholder="Enter your business name (DBA)..."
                                            onChange={onInputChange}
                                        />
                                    </Form.Group>
                                </Col>
                            </Row>
                            <Row className="align-items-center">
                                <Col lg={12} className="mb-3">
                                    <Form.Group controlId="organizationType">
                                        <Form.Label>Business Type</Form.Label>
                                        <Form.Control
                                            value={organizationType}
                                            name="organizationType"
                                            onChange={onInputChange}
                                            as="select"
                                        >
                                            {
                                                orgTypeOptions.map((option, index) => (
                                                    <option key={index} value={option.value}>{option.label}</option>
                                                ))
                                            }
                                        </Form.Control>
                                    </Form.Group>
                                </Col>
                            </Row>
                        </>
                    }
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
                        <Button
                            variant="primary"
                            type="submit"
                            disabled={isFormDisabled}
                            onClick={onContinue}
                            onSubmit={onContinue}
                        >Continue</Button>
                    </div>
                </Form>
            </Card.Body>
        </Card>
    );
};

export default UserProfileForm;
