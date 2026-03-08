/* eslint-disable react/prop-types */
import React from 'react';
import { Alert, Stack } from '@mantine/core';
import PhoneInput, { flags, isValidPhoneNumber } from 'react-phone-number-input';
import { IUserState } from 'therr-react/types';
import {
    MantineButton,
    MantineInput,
    MantineSelect,
} from 'therr-react/components/mantine';
import translator from '../../services/translator';

interface ICreateConnectionFormState {
    inputs: any;
    hasValidationErrors: boolean;
    prevRequestError: string;
    prevRequestSuccess: string;
    isPhoneNumberValid: boolean;
}

interface ICreateConnectionFormProps {
    createUserConnection: Function;
    user: IUserState;
}

class CreateConnectionForm extends React.Component<ICreateConnectionFormProps, ICreateConnectionFormState> {
    private translate: (key: string, params?: any) => string;

    constructor(props: ICreateConnectionFormProps) {
        super(props);

        this.state = {
            hasValidationErrors: true,
            inputs: {
                connectionIdentifier: '',
                phoneNumber: '',
            },
            prevRequestError: '',
            prevRequestSuccess: '',
            isPhoneNumberValid: false,
        };

        this.translate = (key: string, params: any) => translator('en-us', key, params);
    }

    isFormValid() {
        const { hasValidationErrors, inputs } = this.state;
        if (inputs.connectionIdentifier === 'acceptingUserEmail') {
            return !hasValidationErrors
            && !!inputs.email;
        }

        return isValidPhoneNumber(inputs.phoneNumber);
    }

    onInputChange = (name: string, value: string) => {
        const newInputChanges = {
            [name]: (this.state.inputs.connectionIdentifier === 'acceptingUserEmail')
                ? value.toLowerCase()
                : value,
        };
        this.setState({
            inputs: {
                ...this.state.inputs,
                ...newInputChanges,
            },
            prevRequestError: '',
            prevRequestSuccess: '',
        });
    };

    onPhoneInputChange = (value: string) => {
        let safeValue = value;
        if (typeof value !== 'string') {
            safeValue = '+';
        }
        this.setState({
            inputs: {
                ...this.state.inputs,
                phoneNumber: safeValue,
            },
            isPhoneNumberValid: isValidPhoneNumber(safeValue),
            prevRequestError: '',
            prevRequestSuccess: '',
        });
    };

    onValidateInput = (validations: Record<string, string>) => {
        const hasValidationErrors = Object.values(validations).some((msg) => !!msg);
        this.setState({
            hasValidationErrors,
        });
    };

    onSubmit = (event: any) => {
        if (this.isFormValid()) {
            const { inputs } = this.state;
            const { createUserConnection, user } = this.props;
            const reqBody: any = {
                requestingUserId: user.details.id,
                requestingUserFirstName: user.details.firstName,
                requestingUserLastName: user.details.lastName,
                requestingUserEmail: user.details.email,
            };
            if (this.state.inputs.connectionIdentifier === 'acceptingUserEmail') {
                reqBody.acceptingUserEmail = inputs.email;
            }
            if (this.state.inputs.connectionIdentifier === 'acceptingUserPhoneNumber') {
                reqBody.acceptingUserPhoneNumber = inputs.phoneNumber;
            }

            createUserConnection(reqBody, user.details)
                .then(() => {
                    this.setState({
                        inputs: {
                            connectionIdentifier: '',
                            phoneNumber: '',
                        },
                        prevRequestSuccess: this.translate('pages.userProfile.connectionSent'),
                    });
                })
                .catch((error) => {
                    if (error.statusCode === 400 || error.statusCode === 404) {
                        this.setState({
                            prevRequestError: error.message,
                        });
                    }
                });
        }
    };

    onSelectChange = (value: string | null) => {
        this.onInputChange('connectionIdentifier', value || '');
    };

    render() {
        const {
            inputs,
            prevRequestSuccess,
            prevRequestError,
        } = this.state;

        return (
            <Stack gap="sm">
                <MantineSelect
                    id="connection_identifier"
                    name="connectionIdentifier"
                    value={inputs.connectionIdentifier || null}
                    onChange={this.onSelectChange}
                    translateFn={this.translate}
                    required
                    placeholder="Choose an identifier..."
                    data={[
                        {
                            label: this.translate('pages.userProfile.labels.phoneNumber'),
                            value: 'acceptingUserPhoneNumber',
                        },
                        {
                            label: this.translate('pages.userProfile.labels.email'),
                            value: 'acceptingUserEmail',
                        },
                    ]}
                />
                {
                    inputs.connectionIdentifier === 'acceptingUserPhoneNumber'
                    && <>
                        <label className="required" htmlFor="phone_number">{this.translate('pages.userProfile.labels.phoneNumber')}:</label>
                        <div className="form-field">
                            <PhoneInput
                                defaultCountry="US"
                                country="US"
                                international={true}
                                flags={flags}
                                value={inputs.phoneNumber}
                                onChange={this.onPhoneInputChange} />
                            {
                                !isValidPhoneNumber(inputs.phoneNumber)
                                && <div className="validation-errors phone">
                                    <div className="message-container icon-small attention-alert">
                                        <em className="message">
                                            {this.translate('pages.userProfile.validationErrors.phoneNumber')}
                                        </em>
                                    </div>
                                </div>
                            }
                        </div>
                    </>
                }
                {
                    inputs.connectionIdentifier === 'acceptingUserEmail'
                    && <MantineInput
                        type="text"
                        id="email"
                        name="email"
                        value={inputs.email}
                        onChange={this.onInputChange}
                        onEnter={this.onSubmit}
                        translateFn={this.translate}
                        validations={['isRequired', 'email']}
                        onValidate={this.onValidateInput}
                        label={this.translate('pages.userProfile.labels.email')}
                    />
                }
                {
                    prevRequestSuccess
                    && <Alert color="green" variant="light">{prevRequestSuccess}</Alert>
                }
                {
                    prevRequestError
                    && <Alert color="red" variant="light">{prevRequestError}</Alert>
                }
                <div className="form-field text-right">
                    <MantineButton
                        id="send_request"
                        text={this.translate('pages.userProfile.buttons.sendRequest')}
                        onClick={this.onSubmit}
                        disabled={!this.isFormValid()}
                        fullWidth
                    />
                </div>
            </Stack>
        );
    }
}

export default CreateConnectionForm;
