/* eslint-disable max-len */

import * as React from 'react';
import { Link } from 'react-router-dom';
import {
    FontAwesomeIcon,
} from '@fortawesome/react-fontawesome';
import {
    faAngleLeft,
    faEnvelope,
    faUnlockAlt,
} from '@fortawesome/free-solid-svg-icons';
import {
    Col,
    Row,
    Form,
    Card,
    Button,
    FormCheck,
    InputGroup,
    ToastProps,
} from 'react-bootstrap';
import translator from '../../services/translator';

// Regular component props
interface ILoginFormProps {
    alert?: string;
    login: Function;
    title?: string;
    toggleAlert: (show?: boolean, alertHeading?: string, alertVariation?: ToastProps['bg'], alertMessage?: string) => any;
}

interface ILoginFormState {
    inputs: any;
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
                userName: '',
                password: '',
                rememberMe: true,
            },
            isSubmitting: false,
        };

        this.translate = (key: string, params: any) => translator('en-us', key, params);
    }

    isLoginFormDisabled() {
        return !this.state.inputs.userName || !this.state.inputs.password || this.state.isSubmitting;
    }

    onSubmit = (event: React.MouseEvent<HTMLElement>) => {
        event.preventDefault();
        const { toggleAlert } = this.props;
        const { password, rememberMe, userName } = this.state.inputs;
        switch (event.currentTarget.id) {
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
                            toggleAlert(true, 'Error Authenticating', 'danger', error.message);
                        } else if (error.statusCode === 403 && error.message === 'One-time password has expired') {
                            toggleAlert(true, 'Token Expired', 'danger', this.translate('components.loginForm.oneTimePasswordExpired'));
                        } else if (error.statusCode === 429 && error.message === 'Too many login attempts, please try again later.') {
                            toggleAlert(true, 'Too Many Requests', 'danger', this.translate('components.loginForm.tooManyRequests'));
                        } else {
                            toggleAlert(true, 'Oops! Something went wrong', 'danger', this.translate('components.loginForm.backendErrorMessage'));
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

    onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        e.preventDefault();
        const { name, value } = e.currentTarget;
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
        this.props.toggleAlert(false);
    };

    onCheckboxChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const { checked } = event.currentTarget;

        const newInputChanges = {
            rememberMe: !this.state.inputs.rememberMe,
        };

        this.setState({
            inputs: {
                ...this.state.inputs,
                ...newInputChanges,
            },
        });
    };

    public render(): JSX.Element | null {
        const { alert, title } = this.props;

        return (
            <Form className='mt-4'>
                <Form.Group className='mb-4' controlId="user_name">
                    <Form.Label>{this.translate('components.loginForm.labels.userName')}</Form.Label>
                    <InputGroup>
                        <InputGroup.Text>
                            <FontAwesomeIcon icon={faEnvelope} />
                        </InputGroup.Text>
                        <Form.Control
                            autoFocus
                            required
                            type='email'
                            name='userName'
                            value={this.state.inputs.userName}
                            onChange={this.onInputChange}
                            placeholder={this.translate('components.loginForm.placeHolders.userName')}
                        />
                    </InputGroup>
                </Form.Group>
                <Form.Group>
                    <Form.Group className='mb-4' controlId="password">
                        <Form.Label>{this.translate('components.loginForm.labels.password')}</Form.Label>
                        <InputGroup>
                            <InputGroup.Text>
                                <FontAwesomeIcon icon={faUnlockAlt} />
                            </InputGroup.Text>
                            <Form.Control
                                required
                                type='password'
                                placeholder={this.translate('components.loginForm.placeHolders.password')}
                                name='password'
                                value={this.state.inputs.password}
                                onChange={this.onInputChange}
                            />
                        </InputGroup>
                    </Form.Group>
                    <div className='d-flex justify-content-between align-items-center mb-4'>
                        <FormCheck id="remember_me" type='checkbox'>
                            <FormCheck.Input id='defaultCheck5' className='me-2' onChange={this.onCheckboxChange} checked={this.state.inputs.rememberMe} />
                            <FormCheck.Label htmlFor='defaultCheck5' className='mb-0'>Remember me</FormCheck.Label>
                        </FormCheck>
                        <Card.Link as={Link} to="/reset-password" className='small text-end'>Forgot password?</Card.Link>
                    </div>
                </Form.Group>
                <Button id="login_button" variant='primary' type='submit' className='w-100' onClick={this.onSubmit} disabled={this.isLoginFormDisabled()}>
                    {this.translate('components.loginForm.buttons.login')}
                </Button>
            </Form>
        );
    }
}

export default LoginFormComponent;
