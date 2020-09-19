import * as React from 'react';
import { Link, RouteComponentProps, withRouter } from 'react-router-dom';
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
    verificationStatus: string;
}

// Environment Variables
const envVars = globalConfig[process.env.NODE_ENV];

/**
 * EmailVerification
 */
export class EmailVerificationComponent extends React.Component<IEmailVerificationProps & IEmailVerificationDispatchProps, IEmailVerificationState> {
    constructor(props: IEmailVerificationProps & IEmailVerificationDispatchProps) {
        super(props);

        this.state = {
            verificationStatus: 'pending',
        };

        this.translate = (key: string, params: any) => translator('en-us', key, params);
    }

    componentDidMount() { // eslint-disable-line class-methods-use-this
        document.title = `Therr | ${this.translate('pages.emailVerification.pageTitle')}`;

        const queryParams = new URLSearchParams(window.location.search);
        const verificationToken = queryParams.get('token');
        VerificationCodesService.verifyEmail(verificationToken)
            .then((response) => {
                this.setState({
                    verificationStatus: 'success',
                });
            })
            .catch((error) => {
                this.setState({
                    verificationStatus: 'failed',
                });
            });
    }

    private translate: Function;

    render() {
        const { verificationStatus } = this.state;

        return (
            <div id="page_email_verification">
                <h1>{this.translate('pages.emailVerification.pageTitle')}</h1>

                <div className="form-field">
                    {
                        verificationStatus === 'pending'
                        && <p>...</p>
                    }
                    {
                        verificationStatus === 'success'
                        && <p>{this.translate('pages.emailVerification.successMessage')}</p>
                    }
                    {
                        verificationStatus === 'failed'
                        && <p>{this.translate('pages.emailVerification.failedMessage')}</p>
                    }
                    <div className="text-center">
                        <Link to="/login">{this.translate('pages.emailVerification.returnToLogin')}</Link>
                    </div>
                </div>
            </div>
        );
    }
}

export default withRouter(EmailVerificationComponent);
