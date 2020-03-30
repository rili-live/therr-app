import * as React from 'react';
import ButtonPrimary from 'rili-public-library/react-components/ButtonPrimary.js';
import Input from 'rili-public-library/react-components/Input.js';
import translator from '../services/translator';

// Regular component props
interface IRegisterFormProps {
  register: Function;
}

interface IRegisterFormState {
    inputs: any;
}

/**
 * RegisterForm
 */
export class RegisterFormComponent extends React.Component<IRegisterFormProps, IRegisterFormState> {
    constructor(props: IRegisterFormProps) {
        super(props);

        this.state = {
            inputs: {},
        };

        this.translate = (key: string, params: any) => translator('en-us', key, params);
    }

    private translate: Function;

    isFormDisabled() {
        return !this.state.inputs.userName || !this.state.inputs.password || !this.isFormValid();
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
    }

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
    }

    public render(): JSX.Element | null {
        return (
            <div className="register-container">
                <h1 className="text-center">Register</h1>
                <label className="required" htmlFor="first_name">First Name:</label>
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

                <label className="required" htmlFor="last_name">Last Name:</label>
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

                <label className="required" htmlFor="e_mail">E-mail:</label>
                <Input
                    type="text"
                    id="e_mail"
                    name="email"
                    value={this.state.inputs.email}
                    onChange={this.onInputChange}
                    onEnter={this.onSubmit}
                    translate={this.translate}
                    validations={['isRequired']}
                />

                <label className="required" htmlFor="phone_number">Mobile Phone #:</label>
                <Input
                    type="text"
                    id="phone_number"
                    name="phoneNumber"
                    value={this.state.inputs.phoneNumber}
                    onChange={this.onInputChange}
                    onEnter={this.onSubmit}
                    translate={this.translate}
                    validations={['isRequired']}
                />

                <label className="required" htmlFor="user_name">Username:</label>
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

                <label className="required" htmlFor="password">Password:</label>
                <Input
                    type="password"
                    id="password"
                    name="password"
                    value={this.state.inputs.password}
                    minLength="8"
                    onChange={this.onInputChange}
                    onEnter={this.onSubmit}
                    translate={this.translate}
                    validations={['isRequired']}
                />

                <label className="required" htmlFor="repeat_password">Repeat Password:</label>
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
                />

                <div className="form-field text-right">
                    <ButtonPrimary id="register" text="Register" onClick={this.onSubmit} disabled={this.isFormDisabled()} />
                </div>
            </div>
        );
    }
}

export default RegisterFormComponent;
