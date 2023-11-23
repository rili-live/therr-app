import React, { useState } from 'react';
import {
    Col, Row, Card, Form, Button,
} from 'react-bootstrap';

interface IVerifyPhoneCodeFormProps {
    verificationCode: string;
    onSubmit: any;
    onInputChange: any;
    onResendCode: any;
    isSubmitting?: boolean;
    translate: any;
}

const VerifyPhoneCodeForm = ({
    verificationCode,
    onInputChange,
    onResendCode,
    onSubmit,
    isSubmitting,
    translate,
}: IVerifyPhoneCodeFormProps) => {
    const onSend = (e) => {
        e.preventDefault();

        return onSubmit({
            verificationCode,
        });
    };

    return (
        <Card border="light" className="bg-white shadow-sm mb-4">
            <Card.Body>
                <h5 className="mb-4">Enter Verification Code</h5>
                <p className="mb-4">You should receive a code by text message shortly. Otherwise, please contact us further assistance.</p>
                <Form>
                    <Row>
                        <Col md={6} className="mb-3">
                            <Form.Group id="verification_code">
                                <Form.Label>{translate('components.createProfileForm.labels.verificationCode')}</Form.Label>
                                <Form.Control
                                    value={verificationCode}
                                    name="verificationCode"
                                    required
                                    type="text"
                                    placeholder=""
                                    onChange={onInputChange}
                                />
                            </Form.Group>
                        </Col>
                    </Row>

                    <div className="mt-3 d-flex justify-content-between">
                        <Button
                            variant="secondary"
                            type="submit"
                            disabled={isSubmitting}
                            onClick={onResendCode}
                            className="mx-3"
                        >{translate('components.createProfileForm.buttons.resend')}</Button>
                        <Button
                            variant="primary"
                            type="submit"
                            disabled={!verificationCode || isSubmitting}
                            onClick={onSend}
                        >{translate('components.createProfileForm.buttons.submit')}</Button>
                    </div>

                </Form>
            </Card.Body>
        </Card>
    );
};

export default VerifyPhoneCodeForm;
