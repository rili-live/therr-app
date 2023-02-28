import * as React from 'react';
import { Link } from 'react-router-dom';
import { isValidPhoneNumber } from 'react-phone-number-input';
import {
    ButtonPrimary,
    Input,
} from 'therr-react/components';
import translator from '../../services/translator';

// Regular component props
interface IRegisterFormProps {
  register: Function;
  title: string;
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
        return !this.state.inputs.password || !this.isFormValid();
    }

    isFormValid() {
        return this.state.inputs.password === this.state.inputs.repeatPassword;
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

        console.log(newInputChanges);

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
                phoneNumber: value,
            },
            isPhoneNumberValid: isValidPhoneNumber(value),
        });
    };

    public render(): JSX.Element | null {
        const { isPhoneNumberValid } = this.state;

        return (
            <div className="register-container">
                <div className="flex fill max-wide-20">
                    <h1 className="text-center">{this.props.title}</h1>

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
