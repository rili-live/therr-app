import * as React from 'react';
import { Link } from 'react-router-dom';
import { isValidPhoneNumber } from 'react-phone-number-input';
import isValidPassword from 'therr-js-utilities/is-valid-password';
import {
    ButtonPrimary,
    Input,
    PasswordRequirements,
} from 'therr-react/components';
import translator from '../../services/translator';

// Regular component props
interface IRegisterFormProps {
  register: Function;
  title: string;
  inviteCode?: string;
}

interface IRegisterFormState {
    inputs: any;
    isPhoneNumberValid: boolean;
}

/**
 * RegisterForm
 * TODO: Use timer and mark as spam if form is submitted in less that 2 second
 */
export class RegisterFormComponent extends React.Component<IRegisterFormProps, IRegisterFormState> {
    private translate: Function;

    constructor(props: IRegisterFormProps) {
        super(props);

        this.state = {
            inputs: {},
            isPhoneNumberValid: false,
        };

        this.translate = (key: string, params: any) => translator('en-us', key, params);
    }

    isFormDisabled() {
        return !this.state.inputs.email || !this.state.inputs.password || !this.isFormValid();
    }

    isFormValid() {
        const { inputs } = this.state;
        return inputs.password === inputs.repeatPassword && isValidPassword(inputs.password);
    }

    onSubmit = (event: any) => {
        if (!this.isFormDisabled()) {
            const creds = { ...this.state.inputs };
            delete creds.repeatPassword;
            this.props.register(creds);
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

    public render(): JSX.Element | null {
        const { inviteCode } = this.props;
        const { isPhoneNumberValid } = this.state;

        return (
            <div className="register-container">
                <div className="flex fill max-wide-30">
                    <h1 className="text-center">{this.props.title}</h1>
                    {
                        inviteCode
                        && <h4 className="mb-1 text-underline text-center">
                            {this.translate('components.registerForm.text.signupForRewards', {
                                userName: inviteCode,
                            })}
                        </h4>
                    }
                    {/* <label className="required" htmlFor="e_mail">{this.translate('components.registerForm.labels.email')}:</label> */}
                    <Input
                        type="text"
                        id="e_mail"
                        name="email"
                        value={this.state.inputs.email}
                        onChange={this.onInputChange}
                        onEnter={this.onSubmit}
                        translate={this.translate}
                        validations={['isRequired', 'email']}
                        placeholder={this.translate('components.registerForm.labels.email')}
                    />

                    {/* TODO: RMOBILE-26: Centralize password requirements */}
                    {/* <label className="required" htmlFor="password">{this.translate('components.registerForm.labels.password')}:</label> */}
                    <Input
                        type="password"
                        id="password"
                        name="password"
                        value={this.state.inputs.password}
                        minLength="8"
                        onChange={this.onInputChange}
                        onEnter={this.onSubmit}
                        translate={this.translate}
                        validations={['isRequired', 'password']}
                        placeholder={this.translate('components.registerForm.labels.password')}
                    />

                    {/* <label className="required" htmlFor="repeat_password">{this.translate('components.registerForm.labels.repeatPassword')}:</label> */}
                    <Input
                        autoComplete="off"
                        type="hidden"
                        id="sweety_pie"
                        name="website"
                        value={this.state.inputs.website}
                        onChange={this.onInputChange}
                        onEnter={this.onSubmit}
                        translate={this.translate}
                        placeholder={this.translate('components.registerForm.labels.mySweet')}
                        tabIndex="-1"
                    />

                    <Input
                        type="password"
                        id="repeat_password"
                        name="repeatPassword"
                        value={this.state.inputs.repeatPassword}
                        minLength="8"
                        onChange={this.onInputChange}
                        onEnter={this.onSubmit}
                        translate={this.translate}
                        validations={['isRequired']}
                        placeholder={this.translate('components.registerForm.labels.repeatPassword')}
                    />

                    <PasswordRequirements
                        className="password-requirements mb-2 px-2"
                        password={this.state.inputs.password}
                        translate={this.translate}
                    />

                    <div className="text-left">
                        <Link to="/login">{this.translate('components.registerForm.buttons.backToLogin')}</Link>
                    </div>

                    <div className="form-field text-right">
                        <ButtonPrimary
                            id="register"
                            text={this.translate('components.registerForm.buttons.register')} onClick={this.onSubmit} disabled={this.isFormDisabled()} />
                    </div>

                    <div className="text-center margin-top-lg">
                        <a href="https://www.therr.app/terms-and-conditions.html" target="_blank" rel="noreferrer">
                            {this.translate('components.registerForm.buttons.terms')}
                        </a>
                    </div>
                </div>
            </div>
        );
    }
}

export default RegisterFormComponent;
