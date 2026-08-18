import * as React from 'react';
import { Alert, Stack } from '@mantine/core';
import PhoneInput, { isValidPhoneNumber } from 'react-phone-number-input';
import flags from 'react-phone-number-input/flags'; // eslint-disable-line import/extensions
import { MantineButton } from 'therr-react/components/mantine';
import withTranslation from '../../wrappers/withTranslation';

// Regular component props
interface IVerifyPhoneNumberFormProps {
  errorMessage?: string;
  initialPhoneNumber?: string;
  isSubmitting: boolean;
  onSubmit: Function;
  title: string;
  translate: (key: string, params?: any) => string;
}

interface IVerifyPhoneNumberFormState {
    inputs: any;
}

/**
 * Phone-number entry for standalone (re)verification.
 *
 * Deliberately narrower than `CreateProfileForm`, which collects name, username and
 * account type alongside the number because it runs during onboarding. A user who already
 * has a profile and only needs to re-verify must not be re-asked for any of that — and
 * must not have those fields submitted on their behalf, which is what reusing the
 * onboarding form here would do.
 */
export class VerifyPhoneNumberFormComponent extends React.Component<IVerifyPhoneNumberFormProps, IVerifyPhoneNumberFormState> {
    constructor(props: IVerifyPhoneNumberFormProps) {
        super(props);

        this.state = {
            inputs: {
                phoneNumber: props.initialPhoneNumber || '+1',
            },
        };
    }

    isPhoneNumberValid = () => {
        const { phoneNumber } = this.state.inputs;

        return !!phoneNumber && phoneNumber !== '+1' && isValidPhoneNumber(phoneNumber);
    };

    isFormDisabled() {
        return this.props.isSubmitting || !this.isPhoneNumberValid();
    }

    onPhoneInputChange = (value: string) => {
        this.setState({
            inputs: {
                ...this.state.inputs,
                phoneNumber: value || '+1',
            },
        });
    };

    onSubmit = (event: any) => {
        event.preventDefault();

        if (!this.isFormDisabled()) {
            this.props.onSubmit({ ...this.state.inputs });
        }
    };

    public render(): JSX.Element | null {
        const { errorMessage, title, translate } = this.props;
        const { inputs } = this.state;
        const showValidationError = inputs.phoneNumber
            && inputs.phoneNumber !== '+1'
            && !this.isPhoneNumberValid();

        return (
            <div className="register-container">
                <div className="flex fill">
                    <Stack gap="sm">
                        <h1 className="text-center">{title}</h1>
                        {errorMessage && (
                            <Alert color="red" variant="light">
                                {errorMessage}
                            </Alert>
                        )}

                        <p className="text-center">
                            {translate('pages.verifyPhone.description')}
                        </p>

                        <label htmlFor="phone_number">{translate('pages.verifyPhone.labels.mobilePhone')}:</label>
                        <div className="form-field">
                            <PhoneInput
                                defaultCountry="US"
                                country="US"
                                international={true}
                                flags={flags}
                                value={inputs.phoneNumber}
                                onChange={this.onPhoneInputChange} />
                            {
                                showValidationError
                                && <div className="validation-errors">
                                    <div className="message-container icon-small attention-alert">
                                        <em className="message">
                                            {translate('pages.verifyPhone.validationErrors.phoneNumber')}
                                        </em>
                                    </div>
                                </div>
                            }
                        </div>

                        <div className="form-field text-right">
                            <MantineButton
                                id="verify_phone_send_code"
                                text={translate('pages.verifyPhone.buttons.sendCode')}
                                onClick={this.onSubmit}
                                disabled={this.isFormDisabled()}
                                fullWidth
                            />
                        </div>
                    </Stack>
                </div>
            </div>
        );
    }
}

export default withTranslation(VerifyPhoneNumberFormComponent);
