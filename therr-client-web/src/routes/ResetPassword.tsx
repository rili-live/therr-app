import * as React from 'react';
import { Link, RouteComponentProps, withRouter } from 'react-router-dom';
import {
    ButtonPrimary,
    Input,
} from 'therr-react/components';
import translator from '../services/translator';
import * as globalConfig from '../../../global-config';
import VerificationCodesService from '../services/VerificationCodesService';

interface IResetPasswordRouterProps {

}

type IResetPasswordProps = RouteComponentProps<IResetPasswordRouterProps>

interface IResetPasswordDispatchProps {
// Add your dispatcher properties here
}

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
export class ResetPasswordComponent extends React.Component<IResetPasswordProps & IResetPasswordDispatchProps, IResetPasswordState> {
    private translate: Function;

    constructor(props: IResetPasswordProps & IResetPasswordDispatchProps) {
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
    }

    onInputChange = (name: string, value: string) => {
        this.setState({
            email: value,
        });
    }

    render() {
        const { errorReason, isEmailSent } = this.state;

        return (
            <div id="page_reset_password" className="flex-box space-evenly row">
                <div className="centered-container">
                    <h1 className="text-center">{this.translate('pages.resetPassword.pageTitle')}</h1>

                    <div className="form-field">
                        <p>{this.translate('pages.resetPassword.instructions')}</p>
                    </div>

                    <div className="form-field">
                        {
                            !errorReason && isEmailSent
                            && <p className="alert-success">{this.translate('pages.resetPassword.successMessage')}</p>
                        }
                        {
                            errorReason === 'UserNotFound'
                            && <p className="alert-error">{this.translate('pages.resetPassword.failedMessageUserNotFound')}</p>
                        }
                        {
                            errorReason && errorReason !== 'UserNotFound'
                            && <p className="alert-error">{this.translate('pages.resetPassword.failedMessage')}</p>
                        }
                    </div>

                    <div className="form-field">
                        <label htmlFor="email">{this.translate('pages.resetPassword.labels.email')}:</label>
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
                                id="email" text={this.translate('pages.resetPassword.buttons.send')} onClick={this.onSubmit} disabled={!this.state.email} />
                        </div>
                        <div className="form-field text-center" style={{ padding: '1.5rem 0px 0px 1rem' }}>
                            <div>
                                <Link to="/login">{this.translate('pages.resetPassword.returnToLogin')}</Link>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }
}

export default withRouter(ResetPasswordComponent);
