import * as React from 'react';
import { Link, NavigateFunction } from 'react-router-dom';
import { Alert, Stack } from '@mantine/core';
import {
    MantineButton,
    MantineInput,
} from 'therr-react/components/mantine';
import { AccessLevels, SocketClientActionTypes } from 'therr-js-utilities/constants';
import * as globalConfig from '../../../global-config';
import VerificationCodesService from '../services/VerificationCodesService';
import store from '../store';
import { routeAfterLogin } from './Login';
import withNavigation from '../wrappers/withNavigation';
import withTranslation from '../wrappers/withTranslation';

interface IEmailVerificationRouterProps {
    navigation: {
        navigate: NavigateFunction;
    }
}

interface IEmailVerificationDispatchProps {
// Add your dispatcher properties here
}

interface IEmailVerificationProps extends IEmailVerificationRouterProps, IEmailVerificationDispatchProps {
    translate: (key: string, params?: any) => string;
}

interface IEmailVerificationState {
    email: string;
    errorReason: string;
    verificationStatus: string;
}

// Environment Variables
const envVars = globalConfig[process.env.NODE_ENV];

/**
 * EmailVerification
 */
export class EmailVerificationComponent extends React.Component<IEmailVerificationProps, IEmailVerificationState> {
    constructor(props: IEmailVerificationProps & IEmailVerificationDispatchProps) {
        super(props);

        this.state = {
            email: '',
            errorReason: '',
            verificationStatus: 'pending',
        };
    }

    componentDidMount() { // eslint-disable-line class-methods-use-this
        document.title = `Therr | ${this.props.translate('pages.emailVerification.pageTitle')}`;

        const queryParams = new URLSearchParams(window.location.search);
        const verificationToken = queryParams.get('token');
        VerificationCodesService.verifyEmail(verificationToken)
            .then((response) => {
                const { idToken, refreshToken, id } = response?.data || {};

                if (idToken && id) {
                    // Auto-login: store tokens and dispatch login
                    const userData = {
                        ...response.data,
                    };
                    delete userData.message;

                    sessionStorage.setItem('therrUser', JSON.stringify(userData));
                    localStorage.setItem('therrUser', JSON.stringify(userData));
                    if (refreshToken) {
                        sessionStorage.setItem('therrRefreshToken', refreshToken);
                        localStorage.setItem('therrRefreshToken', refreshToken);
                    }

                    store.dispatch({
                        type: SocketClientActionTypes.LOGIN,
                        data: userData,
                    });
                    // UserActionTypes.LOGIN sets isAuthenticated = true in the user reducer
                    store.dispatch({
                        type: 'LOGIN',
                        data: userData,
                    });

                    const accessLevels = userData.accessLevels || [];
                    const destination = accessLevels.includes(AccessLevels.EMAIL_VERIFIED_MISSING_PROPERTIES)
                        && !accessLevels.includes(AccessLevels.EMAIL_VERIFIED)
                        ? '/create-profile'
                        : routeAfterLogin;
                    this.setState({
                        verificationStatus: 'success',
                    }, () => {
                        this.props.navigation.navigate(destination);
                    });
                } else {
                    // Fallback: redirect to login page if no token returned
                    this.setState({
                        verificationStatus: 'success',
                    }, () => {
                        this.props.navigation.navigate('/login', {
                            state: {
                                successMessage: this.props.translate('pages.emailVerification.successVerifiedMessage'),
                            },
                        });
                    });
                }
            })
            .catch((error) => {
                if (error.message === 'Email already verified') {
                    this.setState({
                        errorReason: 'AlreadyVerified',
                        verificationStatus: 'failed',
                    });
                } else if (error.message === 'Token has expired') {
                    this.setState({
                        errorReason: 'TokenExpired',
                        verificationStatus: 'failed',
                    });
                } else {
                    this.setState({
                        verificationStatus: 'failed',
                    });
                }
            });
    }

    onSubmit = (event: any) => {
        event.preventDefault();
        VerificationCodesService.resendVerification(this.state.email)
            .then(() => {
                this.props.navigation.navigate('/login', {
                    state: {
                        successMessage: this.props.translate('pages.emailVerification.failedMessageVerificationResent', {
                            email: this.state.email,
                        }),
                    },
                });
            })
            .catch((error) => {
                if (error.message === 'Email already verified') {
                    this.props.navigation.navigate('/login', {
                        state: {
                            successMessage: this.props.translate('pages.emailVerification.failedMessageAlreadyVerified'),
                        },
                    });
                }

                if (error.message === 'User not found') {
                    this.setState({
                        errorReason: 'UserNotFound',
                    });
                }
            });
    };

    onInputChange = (name: string, value: string) => {
        this.setState({
            email: value,
        });
    };

    render() {
        const { errorReason, verificationStatus } = this.state;

        return (
            <div id="page_email_verification" className="flex-box space-evenly center row wrap-reverse">
                <div className="register-container">
                    <div className="flex fill max-wide-20">
                        <Stack gap="sm">
                            <h1>{this.props.translate('pages.emailVerification.pageTitle')}</h1>

                            {
                                verificationStatus === 'pending'
                                && <p>...</p>
                            }
                            {
                                verificationStatus === 'success'
                                && <Alert color="green" variant="light">{this.props.translate('pages.emailVerification.successMessage')}</Alert>
                            }
                            {
                                verificationStatus === 'failed' && errorReason === 'AlreadyVerified'
                                && <Alert color="blue" variant="light">{this.props.translate('pages.emailVerification.failedMessageAlreadyVerified')}</Alert>
                            }
                            {
                                verificationStatus === 'failed' && errorReason === 'TokenExpired'
                                && <Alert color="red" variant="light">{this.props.translate('pages.emailVerification.failedMessageExpired')}</Alert>
                            }
                            {
                                verificationStatus === 'failed' && errorReason === 'UserNotFound'
                                && <Alert color="red" variant="light">{this.props.translate('pages.emailVerification.failedMessageUserNotFound')}</Alert>
                            }
                            {
                                verificationStatus === 'failed'
                                && errorReason !== 'AlreadyVerified'
                                && errorReason !== 'TokenExpired'
                                && errorReason !== 'UserNotFound'
                                && <Alert color="red" variant="light">{this.props.translate('pages.emailVerification.failedMessage')}</Alert>
                            }
                            <div className="text-center">
                                <Link to="/login">{this.props.translate('pages.emailVerification.returnToLogin')}</Link>
                            </div>

                            {
                                verificationStatus === 'failed' && errorReason !== 'AlreadyVerified'
                                && <>
                                    <MantineInput
                                        type="text"
                                        id="email"
                                        name="email"
                                        value={this.state.email}
                                        onChange={this.onInputChange}
                                        onEnter={this.onSubmit}
                                        translateFn={this.props.translate}
                                        validations={['isRequired', 'email']}
                                        label={this.props.translate('pages.emailVerification.labels.email')}
                                    />

                                    <div className="form-field text-right">
                                        <MantineButton
                                            id="email"
                                            text={this.props.translate('pages.emailVerification.buttons.send')}
                                            onClick={this.onSubmit}
                                            disabled={!this.state.email}
                                            fullWidth
                                        />
                                    </div>
                                </>
                            }
                        </Stack>
                    </div>
                </div>
            </div>
        );
    }
}

export default withNavigation(withTranslation(EmailVerificationComponent));
