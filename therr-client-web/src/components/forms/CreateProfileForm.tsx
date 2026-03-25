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
        if (this.props.isSubmitting || !inputs.userName || !this.isFormValid()) {
            return true;
        }
        // Business accounts only require firstName; personal accounts require both
        if (inputs.isBusinessAccount) {
            return !inputs.firstName;
        }
        return !inputs.firstName || !inputs.lastName;
    }

    isFormValid() {
        return isValidPhoneNumber(this.state.inputs.phoneNumber);
    }

    onSubmit = (event: any) => {
        event.preventDefault();

        if (!this.isFormDisabled()) {
            const updateArgs = { ...this.state.inputs };
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
        this.setState({
            inputs: {
                ...this.state.inputs,
                isBusinessAccount: value === 'business',
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

                        <MantineInput
                            type="text"
                            id="first_name"
                            name="firstName"
                            value={this.state.inputs.firstName}
                            onChange={this.onInputChange}
                            onEnter={this.onSubmit}
                            translateFn={this.props.translate}
                            validations={['isRequired']}
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
                                validations={['isRequired']}
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

                        <label className="required" htmlFor="phone_number">{this.props.translate('components.createProfileForm.labels.mobilePhone')}:</label>
                        <div className="form-field">
                            <PhoneInput
                                defaultCountry="US"
                                country="US"
                                international={true}
                                flags={flags}
                                value={this.state.inputs.phoneNumber}
                                onChange={this.onPhoneInputChange} />
                            {
                                !isPhoneNumberValid
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
