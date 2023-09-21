import React, { useState } from 'react';
import {
    Col, Row, Card, Form, Button,
} from 'react-bootstrap';
import * as yup from 'yup';
import { VALIDATIONS } from 'therr-react/constants';
import {
    PasswordRequirements,
} from 'therr-react/components';

interface IChangePasswordFormProps {
    onSubmit: (oldPassword, newPassword) => any;
    onValidate: (messageTitle: string, message: string) => any;
    toggleAlert: (show?: boolean) => any;
    translate: any;
}

const schema = yup.object().shape({
    oldPassword: yup.string().required(),
    newPassword: yup.string().matches(RegExp(VALIDATIONS.password.regex)).required(),
    repeatNewPassword: yup.string().matches(RegExp(VALIDATIONS.password.regex), 'Password must meet minimum complexity requirements').required(),
});

const ChangePasswordForm = ({
    onSubmit,
    onValidate,
    translate,
    toggleAlert,
}: IChangePasswordFormProps) => {
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [oldPassword, setOldPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [repeatNewPassword, setRepeatNewPassword] = useState('');

    const onSubmitUpdate: React.MouseEventHandler<HTMLElement> = (e) => {
        e.preventDefault();

        setIsSubmitting(true);

        if (newPassword !== repeatNewPassword) {
            setIsSubmitting(false);
            return onValidate('Input Error', 'Repeated password does not match new password.');
        }

        schema.validate({
            oldPassword,
            newPassword,
            repeatNewPassword,
        })
            .then(() => onSubmit(oldPassword, newPassword))
            .catch((error) => {
                onValidate('Validation Error', error?.message);
            })
            .finally(() => {
                setIsSubmitting(false);
            });
    };

    const onInputChange: React.ChangeEventHandler<HTMLInputElement> = (e) => {
        e.preventDefault();
        const { name, value } = e.currentTarget;

        toggleAlert(false);

        switch (name) {
            case 'oldPassword':
                return setOldPassword(value);
            case 'newPassword':
                return setNewPassword(value);
            case 'repeatNewPassword':
                return setRepeatNewPassword(value);
            default:
                break;
        }
    };

    return (
        <Card border="light" className="bg-white shadow-sm mb-4">
            <Card.Body>
                <h5 className="mb-4">Change Password</h5>
                <Form>
                    <Row>
                        <Col md={4} className="mb-3">
                            <Form.Group id="oldPassword">
                                <Form.Label>Old Password / One-Time Password</Form.Label>
                                <Form.Control
                                    name="oldPassword"
                                    value={oldPassword}
                                    onChange={onInputChange}
                                    required
                                    type="password"
                                    placeholder="Enter your current password..."
                                />
                            </Form.Group>
                        </Col>
                        <Col md={4} className="mb-3">
                            <Form.Group id="newPassword">
                                <Form.Label>New Password</Form.Label>
                                <Form.Control
                                    name="newPassword"
                                    value={newPassword}
                                    onChange={onInputChange}
                                    required
                                    type="password"
                                    placeholder="Enter your new password..."
                                />
                            </Form.Group>
                        </Col>
                        <Col md={4} className="mb-3">
                            <Form.Group id="repeatNewPassword">
                                <Form.Label>Repeat New Password</Form.Label>
                                <Form.Control
                                    name="repeatNewPassword"
                                    value={repeatNewPassword}
                                    onChange={onInputChange}
                                    required
                                    type="password"
                                    placeholder="Repeat your new password..."
                                />
                            </Form.Group>
                        </Col>
                    </Row>
                    <PasswordRequirements
                        className="mb-4 px-2"
                        password={newPassword}
                        translate={translate}
                    />
                    <div className="mt-3 text-right">
                        <Button variant="primary" type="submit" onClick={onSubmitUpdate} disabled={isSubmitting}>Update Password</Button>
                    </div>
                </Form>
            </Card.Body>
        </Card>
    );
};

export default ChangePasswordForm;
