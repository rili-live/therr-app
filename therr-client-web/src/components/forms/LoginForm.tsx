/* eslint-disable max-len */

import * as React from 'react';
import { Link } from 'react-router-dom';
import {
    ButtonPrimary,
    Input,
} from 'therr-react/components';
import translator from '../../services/translator';

// Regular component props
interface ILoginFormProps {
    alert?: string;
    login: Function;
    title?: string;
    className?: string;
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
    private translate: Function;

    constructor(props: ILoginFormProps) {
        super(props);

        this.state = {
            inputs: {
                rememberMe: true,
            },
            prevLoginError: '',
            isSubmitting: false,
        };

        this.translate = (key: string, params: any) => translator('en-us', key, params);
    }

    isLoginFormDisabled() {
        return !this.state.inputs.userName || !this.state.inputs.password || this.state.isSubmitting;
    }

    onSubmit = (event: any) => {
        event.preventDefault();
        const { password, rememberMe, userName } = this.state.inputs;
        switch (event.target.id) {
            case 'password':
            case 'user_name':
            case 'login_button':
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
                            });
                        } else if (error.statusCode === 403 && error.message === 'One-time password has expired') {
                            this.setState({
                                prevLoginError: this.translate('components.loginForm.oneTimePasswordExpired'),
                            });
                        } else if (error.statusCode === 429 && error.message === 'Too many login attempts, please try again later.') {
                            this.setState({
                                prevLoginError: this.translate('components.loginForm.tooManyRequests'),
                            });
                        } else {
                            this.setState({
                                prevLoginError: this.translate('components.loginForm.backendErrorMessage'),
                            });
                        }
                        this.setState({
                            isSubmitting: false,
                        });
                    });
                }
                break;
            default:
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
            prevLoginError: '',
        });
    };

    public render(): JSX.Element | null {
        const { prevLoginError } = this.state;
        const { alert, className, title } = this.props;

        return (
            <div className={`login-container ${className}`}>
                <div className="flex fill max-wide-20">
                    <h1 className="text-title-medium">{ title || this.translate('components.loginForm.defaultTitle') }</h1>
                    {
                        alert && !prevLoginError
                        && <div className="text-center alert-success">{alert}</div>
                    }
                    {
                        prevLoginError
                        && <div className="text-center alert-error backed padding-sm">{prevLoginError}</div>
                    }
                    {/* <label htmlFor="user_name">{this.translate('components.loginForm.labels.userName')}:</label> */}
                    <Input
                        type="text"
                        id="user_name"
                        name="userName"
                        value={this.state.inputs.userName}
                        onChange={this.onInputChange}
                        onEnter={this.onSubmit}
                        translate={this.translate}
                        validations={['isRequired']}
                        placeholder={this.translate('components.loginForm.labels.userName')}
                    />

                    {/* TODO: RMOBILE-26: Centralize password requirements */}
                    {/* <label htmlFor="password">{this.translate('components.loginForm.labels.password')}:</label> */}
                    <Input
                        type="password"
                        id="password"
                        name="password"
                        value={this.state.inputs.password}
                        onChange={this.onInputChange}
                        onEnter={this.onSubmit}
                        placeholder={this.translate('components.loginForm.labels.password')}
                        translate={this.translate}
                        validations={['isRequired']}
                    />

                    <div className="form-field text-right" style={{ paddingTop: '.5rem' }}>
                        <ButtonPrimary
                            id="login_button" text={this.translate('components.loginForm.buttons.login')} onClick={this.onSubmit} disabled={this.isLoginFormDisabled()} />
                    </div>

                    <div className="text-center" style={{ padding: '1.5rem 0 0 1rem' }}>
                        <Link to="/register">{this.translate('components.loginForm.buttons.signUp')}</Link> | <Link to="/reset-password">{this.translate('components.loginForm.buttons.forgotPassword')}</Link>
                    </div>
                </div>
            </div>
        );
    }
}

export default LoginFormComponent;
