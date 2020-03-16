import * as React from 'react';
import { Link } from 'react-router-dom';
import ButtonPrimary from 'rili-public-library/react-components/ButtonPrimary.js';
import Input from 'rili-public-library/react-components/Input.js';
import translator from '../services/translator';

// Regular component props
interface ILoginFormProps {
    alert?: string;
    login: Function;
    title?: string;
}

interface ILoginFormState {
    inputs: any;
}

/**
 * LoginForm
 */
export class LoginFormComponent extends React.Component<ILoginFormProps, ILoginFormState> {
    constructor(props: ILoginFormProps) {
        super(props);

        this.state = {
            inputs: {},
        };

        this.translate = (key: string, params: any) => translator('en-us', key, params);
    }

    private translate: Function;

    isLoginFormDisabled() {
        return !this.state.inputs.userName || !this.state.inputs.password;
    }

    onSubmit = (event: any) => {
        const { password, rememberMe, userName } = this.state.inputs;
        switch (event.target.id) {
            case 'password':
            case 'user_name':
            case 'login':
                if (!this.isLoginFormDisabled()) {
                    this.props.login({
                        userName,
                        password,
                        rememberMe,
                    });
                }
                break;
            default:
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
        const { alert, title } = this.props;

        return (
            <div className="login-container">
                <h1 className="text-center">{ title || 'Login' }</h1>
                {
                    alert
              && <div className="text-center alert-success">{alert}</div>
                }
                <label htmlFor="user_name">Username:</label>
                <Input
                    type="text"
                    id="user_name"
                    name="userName"
                    value={this.state.inputs.userName}
                    onChange={this.onInputChange}
                    onEnter={this.onSubmit}
                    translate={this.translate}
                />

                <label htmlFor="passwork">Password:</label>
                <Input
                    type="password"
                    id="password"
                    name="password"
                    value={this.state.inputs.password}
                    onChange={this.onInputChange}
                    onEnter={this.onSubmit}
                    translate={this.translate}
                />

                <div className="text-left">
                    <Link to="/register">Sign Up</Link>
                </div>

                <div className="form-field text-right">
                    <ButtonPrimary id="login" text="Login" onClick={this.onSubmit} disabled={this.isLoginFormDisabled()} />
                </div>
            </div>
        );
    }
}

export default LoginFormComponent;
