import * as React from 'react';
import { Link } from 'react-router-dom';
import PhoneInput, { isValidPhoneNumber } from 'react-phone-number-input';
import flags from 'react-phone-number-input/flags'; // eslint-disable-line import/extensions
import {
    ButtonPrimary,
    Input,
} from 'therr-react/components';
import translator from '../../services/translator';

// Regular component props
interface ICreateProfileFormProps {
  isSubmitting: boolean;
  onSubmit: Function;
  title: string;
}

interface ICreateProfileFormState {
    inputs: any;
    isPhoneNumberValid: boolean;
}

/**
 * CreateProfileForm
 */
export class CreateProfileFormComponent extends React.Component<ICreateProfileFormProps, ICreateProfileFormState> {
    private translate: Function;

    constructor(props: ICreateProfileFormProps) {
        super(props);

        this.state = {
            inputs: {
                phoneNumber: '',
            },
            isPhoneNumberValid: false,
        };

        this.translate = (key: string, params: any) => translator('en-us', key, params);
    }

    isFormDisabled() {
        return this.props.isSubmitting || !this.state.inputs.userName || !this.isFormValid();
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
        const newInputChanges = {
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
        const { isPhoneNumberValid } = this.state;

        return (
            <div className="register-container">
                <div className="flex fill">
                    <h1 className="text-center">{this.props.title}</h1>

                    <label className="required" htmlFor="user_name">{this.translate('components.createProfileForm.labels.userName')}:</label>
                    <Input
                        type="text"
                        id="user_name"
                        name="userName"
                        value={this.state.inputs.userName}
                        onChange={this.onInputChange}
                        onEnter={this.onSubmit}
                        translate={this.translate}
                        validations={['isRequired']}
                    />

                    <label className="required" htmlFor="first_name">{this.translate('components.createProfileForm.labels.firstName')}:</label>
                    <Input
                        type="text"
                        id="first_name"
                        name="firstName"
                        value={this.state.inputs.firstName}
                        onChange={this.onInputChange}
                        onEnter={this.onSubmit}
                        translate={this.translate}
                        validations={['isRequired']}
                    />

                    <label className="required" htmlFor="last_name">{this.translate('components.createProfileForm.labels.lastName')}:</label>
                    <Input
                        type="text"
                        id="last_name"
                        name="lastName"
                        value={this.state.inputs.lastName}
                        onChange={this.onInputChange}
                        onEnter={this.onSubmit}
                        translate={this.translate}
                        validations={['isRequired']}
                    />

                    <label className="required" htmlFor="phone_number">{this.translate('components.createProfileForm.labels.mobilePhone')}:</label>
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
                                        {this.translate('components.createProfileForm.validationErrors.phoneNumber')}
                                    </em>
                                </div>
                            </div>
                        }
                    </div>

                    <div className="form-field text-right">
                        <ButtonPrimary
                            id="register"
                            text={this.translate('components.createProfileForm.buttons.submit')} onClick={this.onSubmit} disabled={this.isFormDisabled()} />
                    </div>

                    <div className="form-field">
                        <h2 className="text-title-medium text-center no-bot-margin fill">
                            {this.translate('pages.createProfile.infoTitle')}
                        </h2>
                        <p className="info-text text-center fill">{this.translate('pages.createProfile.info')}</p>
                    </div>
                </div>
            </div>
        );
    }
}

export default CreateProfileFormComponent;
