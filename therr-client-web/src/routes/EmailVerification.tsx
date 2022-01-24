import * as React from 'react';
import { Link, RouteComponentProps, withRouter } from 'react-router-dom';
import {
    ButtonPrimary,
    Input,
} from 'therr-react/components';
import translator from '../services/translator';
import * as globalConfig from '../../../global-config';
import VerificationCodesService from '../services/VerificationCodesService';

interface IEmailVerificationRouterProps {

}

type IEmailVerificationProps = RouteComponentProps<IEmailVerificationRouterProps>

interface IEmailVerificationDispatchProps {
// Add your dispatcher properties here
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
export class EmailVerificationComponent extends React.Component<IEmailVerificationProps & IEmailVerificationDispatchProps, IEmailVerificationState> {
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
                    this.props.history.push({
                        pathname: '/login',
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
                this.props.history.push({
                    pathname: '/login',
                    state: {
                        successMessage: this.translate('pages.emailVerification.failedMessageVerificationResent', {
                            email: this.state.email,
                        }),
                    },
                });
            })
            .catch((error) => {
                if (error.message === 'Email already verified') {
                    this.props.history.push({
                        pathname: '/login',
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
    }

    onInputChange = (name: string, value: string) => {
        this.setState({
            email: value,
        });
    }

    render() {
        const { errorReason, verificationStatus } = this.state;

        return (
            <div id="page_email_verification" className="flex-box space-evenly center row wrap-reverse">
                <div className="register-container">
                    <div className="flex fill max-wide-20">
                        <h1>{this.translate('pages.emailVerification.pageTitle')}</h1>

                        <div className="form-field">
                            {
                                verificationStatus === 'pending'
                                && <p>...</p>
                            }
                            {
                                verificationStatus === 'success'
                                && <p className="alert-success">{this.translate('pages.emailVerification.successMessage')}</p>
                            }
                            {
                                verificationStatus === 'failed' && errorReason === 'TokenExpired'
                                && <p className="alert-error">{this.translate('pages.emailVerification.failedMessageExpired')}</p>
                            }
                            {
                                verificationStatus === 'failed' && errorReason === 'UserNotFound'
                                && <p className="alert-error">{this.translate('pages.emailVerification.failedMessageUserNotFound')}</p>
                            }
                            {
                                verificationStatus === 'failed' && errorReason !== 'TokenExpired' && errorReason !== 'UserNotFound'
                                && <p className="alert-error">{this.translate('pages.emailVerification.failedMessage')}</p>
                            }
                            <div className="text-center">
                                <Link to="/login">{this.translate('pages.emailVerification.returnToLogin')}</Link>
                            </div>
                        </div>

                        {
                            verificationStatus === 'failed'
                            && <div className="form-field">
                                <label htmlFor="email">{this.translate('pages.emailVerification.labels.email')}:</label>
                                <Input
                                    type="text"
                                    id="email"
                                    name="email"
                                    value={this.state.email}
                                    onChange={this.onInputChange}
                                    onEnter={this.onSubmit}
                                    translate={this.translate}
                                    validations={['isRequired', 'email']}
                                />

                                <div className="form-field text-right">
                                    <ButtonPrimary
                                        id="email"
                                        text={this.translate('pages.emailVerification.buttons.send')}
                                        onClick={this.onSubmit}
                                        disabled={!this.state.email}
                                    />
                                </div>
                            </div>
                        }
                    </div>
                </div>
            </div>
        );
    }
}

export default withRouter(EmailVerificationComponent);
