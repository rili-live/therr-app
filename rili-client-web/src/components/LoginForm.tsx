import * as React from 'react';
import { Link } from 'react-router-dom';
import {
    ButtonPrimary,
    Input,
} from 'rili-react/components';
import translator from '../services/translator';

// Regular component props
interface ILoginFormProps {
    alert?: string;
    login: Function;
    title?: string;
}

interface ILoginFormState {
    inputs: any;
    prevLoginError: string;
    isSubmitting: boolean;
}

/**
 * LoginForm
 */
export class LoginFormComponent extends React.Component<ILoginFormProps, ILoginFormState> {
    constructor(props: ILoginFormProps) {
        super(props);

        this.state = {
            inputs: {},
            prevLoginError: '',
            isSubmitting: false,
        };

        this.translate = (key: string, params: any) => translator('en-us', key, params);
    }

    private translate: Function;

    isLoginFormDisabled() {
        return !this.state.inputs.userName || !this.state.inputs.password || this.state.isSubmitting;
    }

    onSubmit = (event: any) => {
        event.preventDefault();
        const { password, rememberMe, userName } = this.state.inputs;
        switch (event.target.id) {
            case 'password':
            case 'user_name':
            case 'login':
                if (!this.isLoginFormDisabled()) {
                    this.setState({
                        isSubmitting: true,
                    });
                    this.props.login({
                        userName,
                        password,
                        rememberMe,
                    }).catch((error: any) => {
                        if (error.statusCode === 401 || error.statusCode === 404) {
                            this.setState({
                                prevLoginError: error.message,
                                isSubmitting: false,
                            });
                        }
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

        if (name === 'userName') {
            newInputChanges[name] = value.toLowerCase();
        }

        this.setState({
            inputs: {
                ...this.state.inputs,
                ...newInputChanges,
            },
            prevLoginError: '',
        });
    }

    public render(): JSX.Element | null {
        const { prevLoginError } = this.state;
        const { alert, title } = this.props;

        return (
            <div className="login-container">
                <h1 className="text-center">{ title || this.translate('components.loginForm.defaultTitle') }</h1>
                {
                    alert
                     && <div className="text-center alert-success">{alert}</div>
                }
                {
                    prevLoginError
                    && <div className="text-center alert-error backed padding-sm">{prevLoginError}</div>
                }
                <label htmlFor="user_name">{this.translate('components.loginForm.labels.userName')}:</label>
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

                <label htmlFor="passwork">{this.translate('components.loginForm.labels.password')}:</label>
                <Input
                    type="password"
                    id="password"
                    name="password"
                    value={this.state.inputs.password}
                    onChange={this.onInputChange}
                    onEnter={this.onSubmit}
                    translate={this.translate}
                    validations={['isRequired']}
                />

                <div className="text-left">
                    <Link to="/register">{this.translate('components.loginForm.buttons.signUp')}</Link>
                </div>

                <div className="form-field text-right">
                    <ButtonPrimary
                        id="login" text={this.translate('components.loginForm.buttons.login')} onClick={this.onSubmit} disabled={this.isLoginFormDisabled()} />
                </div>
            </div>
        );
    }
}

export default LoginFormComponent;
