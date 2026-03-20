import * as React from 'react';
import { Link } from 'react-router-dom';
import {
    Alert, Anchor, Button, Stack,
} from '@mantine/core';
import {
    MantineButton,
    MantineInput,
} from 'therr-react/components/mantine';
import GoogleSignInButtonWeb from './GoogleSignInButtonWeb';
import withTranslation from '../../wrappers/withTranslation';

// Regular component props
interface ILoginFormProps {
    alert?: string;
    alertVariation?: 'success' | 'error';
    login: Function;
    onGoogleLogin?: Function;
    title?: string;
    className?: string;
    translate: (key: string, params?: any) => string;
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
            inputs: {
                rememberMe: true,
            },
            prevLoginError: '',
            isSubmitting: false,
        };
    }

    isLoginFormDisabled() {
        return !this.state.inputs.userName
            || !this.state.inputs.password
            || this.state.isSubmitting;
    }

    onSubmit = (event: any) => {
        event.preventDefault();
        const { password, rememberMe, userName } = this.state.inputs;
        switch (event.target.id || event.currentTarget.id) {
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
                        } else if (error.statusCode === 403
                            && error.message === 'One-time password has expired') {
                            this.setState({
                                prevLoginError: this.props.translate(
                                    'components.loginForm.oneTimePasswordExpired',
                                ),
                            });
                        } else if (error.statusCode === 429
                            && error.message === 'Too many login attempts, please try again later.') {
                            this.setState({
                                prevLoginError: this.props.translate(
                                    'components.loginForm.tooManyRequests',
                                ),
                            });
                        } else {
                            this.setState({
                                prevLoginError: this.props.translate(
                                    'components.loginForm.backendErrorMessage',
                                ),
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
        const {
            alert,
            alertVariation,
            className,
            title,
        } = this.props;

        return (
            <div className={`login-container ${className}`}>
                <div className="flex fill max-wide-20">
                    <Stack gap="sm">
                        <h1 className="text-title-medium">
                            {title || this.props.translate('components.loginForm.defaultTitle')}
                        </h1>
                        {
                            alert && !prevLoginError
                            && (
                                <Alert
                                    color={alertVariation === 'success' ? 'green' : 'red'}
                                    variant="light"
                                >
                                    {alert}
                                </Alert>
                            )
                        }
                        {
                            prevLoginError
                            && (
                                <Alert color="red" variant="light">
                                    {prevLoginError}
                                </Alert>
                            )
                        }
                        <MantineInput
                            type="text"
                            id="user_name"
                            name="userName"
                            value={this.state.inputs.userName}
                            onChange={this.onInputChange}
                            onEnter={this.onSubmit}
                            translateFn={this.props.translate}
                            validations={['isRequired']}
                            label={this.props.translate('components.loginForm.labels.userName')}
                        />

                        <MantineInput
                            type="password"
                            id="password"
                            name="password"
                            value={this.state.inputs.password}
                            onChange={this.onInputChange}
                            onEnter={this.onSubmit}
                            label={this.props.translate('components.loginForm.labels.password')}
                            translateFn={this.props.translate}
                            validations={['isRequired']}
                        />

                        <div className="form-field text-right" style={{ paddingTop: '.5rem' }}>
                            <MantineButton
                                id="login_button"
                                text={this.props.translate('components.loginForm.buttons.login')}
                                onClick={this.onSubmit}
                                disabled={this.isLoginFormDisabled()}
                                loading={this.state.isSubmitting}
                                fullWidth
                            />
                        </div>

                        {this.props.onGoogleLogin && (
                            <>
                                <div className="sso-divider" style={{ textAlign: 'center', margin: '0.75rem 0' }}>
                                    {this.props.translate('components.loginForm.sso.orDivider')}
                                </div>
                                <GoogleSignInButtonWeb
                                    onSuccess={(ssoData) => this.props.onGoogleLogin(ssoData)}
                                    onError={(msg) => this.setState({ prevLoginError: msg })}
                                    buttonText="signin_with"
                                    translate={this.props.translate}
                                />
                            </>
                        )}

                        <Stack gap="xs" align="center" mt="xs">
                            <Button
                                variant="subtle"
                                component={Link}
                                to="/register"
                                fullWidth
                            >
                                {this.props.translate('components.loginForm.buttons.signUp')}
                            </Button>
                            <Anchor component={Link} to="/reset-password" size="sm">
                                {this.props.translate('components.loginForm.buttons.forgotPassword')}
                            </Anchor>
                        </Stack>
                    </Stack>
                </div>
            </div>
        );
    }
}

export default withTranslation(LoginFormComponent);
