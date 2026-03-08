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

interface IResetPasswordRouterProps {
    navigation: {
        navigate: NavigateFunction;
    }
}

interface IResetPasswordDispatchProps {
// Add your dispatcher properties here
}

interface IResetPasswordProps extends IResetPasswordRouterProps, IResetPasswordDispatchProps {}

interface IResetPasswordState {
    email: string;
    errorReason: string;
    isEmailSent: boolean;
}

// Environment Variables
const envVars = globalConfig[process.env.NODE_ENV];

/**
 * ResetPassword
 */
export class ResetPasswordComponent extends React.Component<IResetPasswordProps, IResetPasswordState> {
    private translate: Function;

    constructor(props: IResetPasswordProps) {
        super(props);

        this.state = {
            email: '',
            errorReason: '',
            isEmailSent: false,
        };

        this.translate = (key: string, params: any) => translator('en-us', key, params);
    }

    componentDidMount() { // eslint-disable-line class-methods-use-this
        document.title = `Therr | ${this.translate('pages.resetPassword.pageTitle')}`;
    }

    onSubmit = (event: any) => {
        event.preventDefault();
        VerificationCodesService.requestOneTimePassword(this.state.email)
            .then(() => {
                this.setState({
                    errorReason: '',
                    isEmailSent: true,
                });
            })
            .catch((error) => {
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
        const { errorReason, isEmailSent } = this.state;

        return (
            <div id="page_reset_password" className="flex-box space-evenly center row wrap-reverse">
                <div className="flex fill max-wide-20">
                    <Stack gap="sm">
                        <h1 className="text-center">{this.translate('pages.resetPassword.pageTitle')}</h1>

                        <p>{this.translate('pages.resetPassword.instructions')}</p>

                        {
                            !errorReason && isEmailSent
                            && <Alert color="green" variant="light">{this.translate('pages.resetPassword.successMessage')}</Alert>
                        }
                        {
                            errorReason === 'UserNotFound'
                            && <Alert color="red" variant="light">{this.translate('pages.resetPassword.failedMessageUserNotFound')}</Alert>
                        }
                        {
                            errorReason && errorReason !== 'UserNotFound'
                            && <Alert color="red" variant="light">{this.translate('pages.resetPassword.failedMessage')}</Alert>
                        }

                        <MantineInput
                            type="text"
                            id="email"
                            name="email"
                            value={this.state.email}
                            onChange={this.onInputChange}
                            onEnter={this.onSubmit}
                            translateFn={this.translate}
                            validations={['isRequired', 'email']}
                            placeholder={this.translate('pages.resetPassword.labels.email')}
                        />

                        <div className="form-field text-right">
                            <MantineButton
                                id="email"
                                text={this.translate('pages.resetPassword.buttons.send')}
                                onClick={this.onSubmit}
                                disabled={!this.state.email}
                                fullWidth
                            />
                        </div>
                        <div className="form-field text-center" style={{ padding: '1.5rem 0px 0px 0px' }}>
                            <div>
                                <Link to="/login">{this.translate('pages.resetPassword.returnToLogin')}</Link>
                            </div>
                        </div>
                    </Stack>
                </div>
            </div>
        );
    }
}

export default withNavigation(ResetPasswordComponent);
