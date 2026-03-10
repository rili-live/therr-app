import * as React from 'react';
import { Stack } from '@mantine/core';
import {
    MantineButton,
    MantineInput,
} from 'therr-react/components/mantine';
import withTranslation from '../../wrappers/withTranslation';

// Regular component props
interface IVerifyPhoneCodeFormProps {
  isSubmitting: boolean;
  onSubmit: Function;
  onSubmitVerify: Function;
  title: string;
  translate: (key: string, params?: any) => string;
}

interface IVerifyPhoneCodeFormState {
    inputs: any;
}

/**
 * VerifyPhoneCodeForm
 */
export class VerifyPhoneCodeFormComponent extends React.Component<IVerifyPhoneCodeFormProps, IVerifyPhoneCodeFormState> {
    constructor(props: IVerifyPhoneCodeFormProps) {
        super(props);

        this.state = {
            inputs: {
                phoneNumber: '',
            },
        };
    }

    isFormDisabled() {
        return this.props.isSubmitting || !this.state.inputs.verificationCode;
    }

    onSubmit = (event: any) => {
        event.preventDefault();

        if (!this.isFormDisabled()) {
            const updateArgs = { ...this.state.inputs };
            this.props.onSubmit(updateArgs);
        }
    };

    onResendCode = (event: any) => {
        event.preventDefault();

        this.props.onSubmitVerify();
    };

    onInputChange = (name: string, value: string) => {
        const newInputChanges = {
            [name]: value,
        };

        this.setState({
            inputs: {
                ...this.state.inputs,
                ...newInputChanges,
            },
        });
    };

    public render(): JSX.Element | null {
        return (
            <div className="register-container">
                <div className="flex fill">
                    <Stack gap="sm">
                        <h1 className="text-center">{this.props.title}</h1>

                        <MantineInput
                            type="text"
                            id="verification_code"
                            name="verificationCode"
                            value={this.state.inputs.verificationCode}
                            onChange={this.onInputChange}
                            onEnter={this.onSubmit}
                            translateFn={this.props.translate}
                            validations={['isRequired']}
                            label={this.props.translate('components.createProfileForm.labels.verificationCode')}
                        />

                        <div className="form-field flex-box space-between row">
                            <MantineButton
                                id="resend_phone"
                                text={this.props.translate('components.createProfileForm.buttons.resend')}
                                onClick={this.onResendCode}
                                variant="outline"
                            />
                            <MantineButton
                                id="verify_phone"
                                text={this.props.translate('components.createProfileForm.buttons.submit')}
                                onClick={this.onSubmit}
                                disabled={this.isFormDisabled()}
                            />
                        </div>
                    </Stack>
                </div>
            </div>
        );
    }
}

export default withTranslation(VerifyPhoneCodeFormComponent);
