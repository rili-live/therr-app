import * as React from 'react';
import { Alert, SegmentedControl, Stack } from '@mantine/core';
import PhoneInput, { isValidPhoneNumber } from 'react-phone-number-input';
import flags from 'react-phone-number-input/flags'; // eslint-disable-line import/extensions
import {
    MantineButton,
    MantineInput,
} from 'therr-react/components/mantine';
import withTranslation from '../../wrappers/withTranslation';

// Regular component props
interface ICreateProfileFormProps {
  errorMessage?: string;
  isSubmitting: boolean;
  onSubmit: Function;
  title: string;
  translate: (key: string, params?: any) => string;
}

interface ICreateProfileFormState {
    inputs: any;
    isPhoneNumberValid: boolean;
}

/**
 * CreateProfileForm
 */
export class CreateProfileFormComponent extends React.Component<ICreateProfileFormProps, ICreateProfileFormState> {
    private formRef = React.createRef<HTMLDivElement>();

    constructor(props: ICreateProfileFormProps) {
        super(props);

        this.state = {
            inputs: {
                phoneNumber: '',
                isBusinessAccount: false,
            },
            isPhoneNumberValid: false,
        };
    }

    isFormDisabled() {
        const { inputs } = this.state;
        // Only a username is required to complete onboarding. First/last name and
        // phone number are intentionally optional to reduce friction — phone
        // verification is deferred and prompted contextually later, and enforced
        // only on phone-sensitive actions (e.g. sending invites). See onboarding
        // friction review (2026-06) and deferred-phone-verification (2026-07).
        return this.props.isSubmitting || !inputs.userName || !this.isFormValid();
    }

    isFormValid() {
        // Phone is optional; only block submit if a phone was entered but invalid.
        const { phoneNumber } = this.state.inputs;
        return !phoneNumber || phoneNumber === '+1' || isValidPhoneNumber(phoneNumber);
    }

    onSubmit = (event: any) => {
        event.preventDefault();

        if (!this.isFormDisabled()) {
            const updateArgs = { ...this.state.inputs };
            // Don't submit an empty/invalid phone — the user can add it later.
            if (!updateArgs.phoneNumber || updateArgs.phoneNumber === '+1' || !isValidPhoneNumber(updateArgs.phoneNumber)) {
                delete updateArgs.phoneNumber;
            }
            this.props.onSubmit(updateArgs);
        }
    };

    onInputChange = (name: string, value: string) => {
        const newInputChanges: any = {
            [name]: value,
        };

        if (name === 'userName') {
            newInputChanges[name] = value.toLowerCase();
        }

        this.setState({
            inputs: {
                ...this.state.inputs,
                ...newInputChanges,
            },
        });
    };

    onAccountTypeChange = (value: string) => {
        const isBusiness = value === 'business';
        this.setState({
            inputs: {
                ...this.state.inputs,
                isBusinessAccount: isBusiness,
                // Clear lastName when switching to business to avoid stale data
                lastName: isBusiness ? '' : this.state.inputs.lastName,
            },
        });
    };

    onPhoneInputChange = (value: string) => {
        this.setState({
            inputs: {
                ...this.state.inputs,
                phoneNumber: value || '+1',
            },
            isPhoneNumberValid: isValidPhoneNumber(value || '+1'),
        });
    };

    public render(): JSX.Element | null {
        const { errorMessage } = this.props;
        const { isPhoneNumberValid, inputs } = this.state;
        const isBusiness = inputs.isBusinessAccount;

        return (
            <div className="register-container" ref={this.formRef}>
                <div className="flex fill">
                    <Stack gap="sm">
                        <h1 className="text-center">{this.props.title}</h1>
                        {errorMessage && (
                            <Alert color="red" variant="light">
                                {errorMessage}
                            </Alert>
                        )}

                        <div className="form-field">
                            <label htmlFor="account_type">
                                {this.props.translate('components.createProfileForm.labels.accountType')}
                            </label>
                            <SegmentedControl
                                id="account_type"
                                fullWidth
                                value={isBusiness ? 'business' : 'personal'}
                                onChange={this.onAccountTypeChange}
                                data={[
                                    {
                                        label: this.props.translate('components.createProfileForm.labels.personal'),
                                        value: 'personal',
                                    },
                                    {
                                        label: this.props.translate('components.createProfileForm.labels.business'),
                                        value: 'business',
                                    },
                                ]}
                            />
                        </div>

                        <MantineInput
                            type="text"
                            id="user_name"
                            name="userName"
                            value={this.state.inputs.userName}
                            onChange={this.onInputChange}
                            onEnter={this.onSubmit}
                            translateFn={this.props.translate}
                            validations={['isRequired']}
                            label={this.props.translate('components.createProfileForm.labels.userName')}
                        />

                        {/* First/last name are optional during onboarding (see isFormDisabled).
                            Do not mark them isRequired or the input renders a misleading
                            "required" error once touched, contradicting the deferred-name flow. */}
                        <MantineInput
                            type="text"
                            id="first_name"
                            name="firstName"
                            value={this.state.inputs.firstName}
                            onChange={this.onInputChange}
                            onEnter={this.onSubmit}
                            translateFn={this.props.translate}
                            validations={[]}
                            label={isBusiness
                                ? this.props.translate('components.createProfileForm.labels.businessName')
                                : this.props.translate('components.createProfileForm.labels.firstName')}
                        />

                        {!isBusiness && (
                            <MantineInput
                                type="text"
                                id="last_name"
                                name="lastName"
                                value={this.state.inputs.lastName}
                                onChange={this.onInputChange}
                                onEnter={this.onSubmit}
                                translateFn={this.props.translate}
                                validations={[]}
                                label={this.props.translate('components.createProfileForm.labels.lastName')}
                            />
                        )}

                        {isBusiness && (
                            <MantineInput
                                type="text"
                                id="last_name"
                                name="lastName"
                                value={this.state.inputs.lastName}
                                onChange={this.onInputChange}
                                onEnter={this.onSubmit}
                                translateFn={this.props.translate}
                                validations={[]}
                                label={this.props.translate('components.createProfileForm.labels.businessSuffix')}
                            />
                        )}

                        <label htmlFor="phone_number">{this.props.translate('components.createProfileForm.labels.mobilePhone')}:</label>
                        <div className="form-field">
                            <PhoneInput
                                defaultCountry="US"
                                country="US"
                                international={true}
                                flags={flags}
                                value={this.state.inputs.phoneNumber}
                                onChange={this.onPhoneInputChange} />
                            {
                                inputs.phoneNumber && inputs.phoneNumber !== '+1' && !isPhoneNumberValid
                                && <div className="validation-errors">
                                    <div className="message-container icon-small attention-alert">
                                        <em className="message">
                                            {this.props.translate('components.createProfileForm.validationErrors.phoneNumber')}
                                        </em>
                                    </div>
                                </div>
                            }
                        </div>

                        <div className="form-field text-right">
                            <MantineButton
                                id="register"
                                text={this.props.translate('components.createProfileForm.buttons.submit')}
                                onClick={this.onSubmit}
                                disabled={this.isFormDisabled()}
                                fullWidth
                            />
                        </div>

                        <div className="form-field">
                            <h2 className="text-title-medium text-center no-bot-margin fill">
                                {this.props.translate('pages.createProfile.infoTitle')}
                            </h2>
                            <p className="info-text text-center fill">{this.props.translate('pages.createProfile.info')}</p>
                        </div>
                    </Stack>
                </div>
            </div>
        );
    }
}

export default withTranslation(CreateProfileFormComponent);
