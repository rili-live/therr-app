import * as React from 'react';
import { isValidPhoneNumber } from 'react-phone-number-input';
import {
    ButtonPrimary,
    Input,
} from 'therr-react/components';
import translator from '../../services/translator';

// Regular component props
interface IVerifyPhoneCodeFormProps {
  isSubmitting: boolean;
  onSubmit: Function;
  onSubmitVerify: Function;
  title: string;
}

interface IVerifyPhoneCodeFormState {
    inputs: any;
}

/**
 * VerifyPhoneCodeForm
 */
export class VerifyPhoneCodeFormComponent extends React.Component<IVerifyPhoneCodeFormProps, IVerifyPhoneCodeFormState> {
    private translate: Function;

    constructor(props: IVerifyPhoneCodeFormProps) {
        super(props);

        this.state = {
            inputs: {
                phoneNumber: '',
            },
        };

        this.translate = (key: string, params: any) => translator('en-us', key, params);
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
                    <h1 className="text-center">{this.props.title}</h1>

                    <label className="required" htmlFor="verification_code">{this.translate('components.createProfileForm.labels.verificationCode')}:</label>
                    <Input
                        type="text"
                        id="verification_code"
                        name="verificationCode"
                        value={this.state.inputs.verificationCode}
                        onChange={this.onInputChange}
                        onEnter={this.onSubmit}
                        translate={this.translate}
                        validations={['isRequired']}
                    />

                    <div className="form-field flex-box space-between row">
                        <ButtonPrimary
                            id="resend_phone"
                            text={this.translate('components.createProfileForm.buttons.resend')} onClick={this.onResendCode} />
                        <ButtonPrimary
                            id="verify_phone"
                            text={this.translate('components.createProfileForm.buttons.submit')} onClick={this.onSubmit} disabled={this.isFormDisabled()} />
                    </div>
                </div>
            </div>
        );
    }
}

export default VerifyPhoneCodeFormComponent;
