/* eslint-disable react/prop-types */
import React from 'react';
import {
    Input,
    SelectBox,
    SvgButton,
} from 'therr-react/components';
import PhoneInput, { flags, isValidPhoneNumber } from 'react-phone-number-input';
import { IUserState } from 'therr-react/types';
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
    private translate;

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
    }

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
    }

    onValidateInput = (validations: any) => {
        const hasValidationErrors = !!Object.keys(validations).filter((key) => validations[key].length).length;
        this.setState({
            hasValidationErrors,
        });
    }

    onSubmit = (event: any) => {
        if (this.isFormValid()) {
            const { inputs } = this.state;
            const { createUserConnection, user } = this.props;
            const reqBody: any = {
                requestingUserId: user.details.id,
                requestingUserFirstName: user.details.firstName,
                requestingUserLastName: user.details.lastName,
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

    render() {
        const {
            inputs,
            prevRequestSuccess,
            prevRequestError,
        } = this.state;

        return (
            <>
                <SelectBox
                    type="text"
                    id="connection_identifier"
                    name="connectionIdentifier"
                    value={inputs.connectionIdentifier}
                    onChange={this.onInputChange}
                    onEnter={this.onSubmit}
                    translate={this.translate}
                    options={[
                        {
                            text: this.translate('pages.userProfile.labels.phoneNumber'),
                            value: 'acceptingUserPhoneNumber',
                        },
                        {
                            text: this.translate('pages.userProfile.labels.email'),
                            value: 'acceptingUserEmail',
                        },
                    ]}
                    placeHolderText="Choose an identifier..."
                    validations={['isRequired']}
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
                    && <>
                        <label className="required" htmlFor="email">{this.translate('pages.userProfile.labels.email')}:</label>
                        <Input
                            type="text"
                            id="email"
                            name="email"
                            value={inputs.email}
                            onChange={this.onInputChange}
                            onEnter={this.onSubmit}
                            translate={this.translate}
                            validations={['isRequired', 'email']}
                            onValidate={this.onValidateInput}
                        />
                    </>
                }
                {
                    prevRequestSuccess
                    && <div className="text-center alert-success">{prevRequestSuccess}</div>
                }
                {
                    prevRequestError
                    && <div className="text-center alert-error backed padding-sm margin-bot-sm">{prevRequestError}</div>
                }
                <div className="form-field text-right">
                    <SvgButton
                        id="send_request"
                        name="send"
                        onClick={this.onSubmit} disabled={!this.isFormValid()} />
                </div>
            </>
        );
    }
}

export default CreateConnectionForm;
