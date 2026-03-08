import * as React from 'react';
import { Link, NavigateFunction } from 'react-router-dom';
import { Alert, Stack } from '@mantine/core';
import {
    MantineButton,
    MantineInput,
} from 'therr-react/components/mantine';
import translator from '../services/translator';
import * as globalConfig from '../../../global-config';
import VerificationCodesService from '../services/VerificationCodesService';
import withNavigation from '../wrappers/withNavigation';

interface IEmailVerificationRouterProps {
    navigation: {
        navigate: NavigateFunction;
    }
}

interface IEmailVerificationDispatchProps {
// Add your dispatcher properties here
}

interface IEmailVerificationProps extends IEmailVerificationRouterProps, IEmailVerificationDispatchProps {}

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
    private translate: Function;

    constructor(props: IEmailVerificationProps & IEmailVerificationDispatchProps) {
        super(props);

        this.state = {
            email: '',
            errorReason: '',
            verificationStatus: 'pending',
        };

        this.translate = (key: string, params: any) => translator('en-us', key, params);
    }

    componentDidMount() { // eslint-disable-line class-methods-use-this
        document.title = `Therr | ${this.translate('pages.emailVerification.pageTitle')}`;

        const queryParams = new URLSearchParams(window.location.search);
        const verificationToken = queryParams.get('token');
        VerificationCodesService.verifyEmail(verificationToken)
            .then(() => {
                this.setState({
                    verificationStatus: 'success',
                }, () => {
                    this.props.navigation.navigate('/login', {
                        state: {
                            successMessage: this.translate('pages.emailVerification.successVerifiedMessage'),
                        },
                    });
                });
            })
            .catch((error) => {
                if (error.message === 'Token has expired') {
                    this.setState({
                        errorReason: 'TokenExpired',
                    });
                }
                this.setState({
                    verificationStatus: 'failed',
                });
            });
    }

    onSubmit = (event: any) => {
        event.preventDefault();
        VerificationCodesService.resendVerification(this.state.email)
            .then(() => {
                this.props.navigation.navigate('/login', {
                    state: {
                        successMessage: this.translate('pages.emailVerification.failedMessageVerificationResent', {
                            email: this.state.email,
                        }),
                    },
                });
            })
            .catch((error) => {
                if (error.message === 'Email already verified') {
                    this.props.navigation.navigate('/login', {
                        state: {
                            successMessage: this.translate('pages.emailVerification.failedMessageAlreadyVerified'),
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
                            <h1>{this.translate('pages.emailVerification.pageTitle')}</h1>

                            {
                                verificationStatus === 'pending'
                                && <p>...</p>
                            }
                            {
                                verificationStatus === 'success'
                                && <Alert color="green" variant="light">{this.translate('pages.emailVerification.successMessage')}</Alert>
                            }
                            {
                                verificationStatus === 'failed' && errorReason === 'TokenExpired'
                                && <Alert color="red" variant="light">{this.translate('pages.emailVerification.failedMessageExpired')}</Alert>
                            }
                            {
                                verificationStatus === 'failed' && errorReason === 'UserNotFound'
                                && <Alert color="red" variant="light">{this.translate('pages.emailVerification.failedMessageUserNotFound')}</Alert>
                            }
                            {
                                verificationStatus === 'failed' && errorReason !== 'TokenExpired' && errorReason !== 'UserNotFound'
                                && <Alert color="red" variant="light">{this.translate('pages.emailVerification.failedMessage')}</Alert>
                            }
                            <div className="text-center">
                                <Link to="/login">{this.translate('pages.emailVerification.returnToLogin')}</Link>
                            </div>

                            {
                                verificationStatus === 'failed'
                                && <>
                                    <MantineInput
                                        type="text"
                                        id="email"
                                        name="email"
                                        value={this.state.email}
                                        onChange={this.onInputChange}
                                        onEnter={this.onSubmit}
                                        translateFn={this.translate}
                                        validations={['isRequired', 'email']}
                                        placeholder={this.translate('pages.emailVerification.labels.email')}
                                    />

                                    <div className="form-field text-right">
                                        <MantineButton
                                            id="email"
                                            text={this.translate('pages.emailVerification.buttons.send')}
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

export default withNavigation(EmailVerificationComponent);
