import * as React from 'react';
import { Link, NavigateFunction } from 'react-router-dom';
import {
    ButtonPrimary,
    Input,
} from 'therr-react/components';
import {
    Col,
    Row,
    Card,
    Container,
    Toast,
    ToastContainer,
    Form,
    Button,
    InputGroup,
} from 'react-bootstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faEnvelope } from '@fortawesome/free-solid-svg-icons';
import translator from '../services/translator';
import * as globalConfig from '../../../global-config';
import VerificationCodesService from '../services/VerificationCodesService';
import withNavigation from '../wrappers/withNavigation';
import { getWebsiteName } from '../utilities/getHostContext';

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
    alertHeading: string;
    alertIsVisible: boolean;
    alertMessage: string;
    email: string;
    alertVariation: string;
}

// Environment Variables
const envVars = globalConfig[process.env.NODE_ENV];

/**
 * ResetPassword
 */
export class ResetPasswordComponent extends React.Component<IResetPasswordProps, IResetPasswordState> {
    private translate: Function;

    constructor(props: IResetPasswordProps & IResetPasswordDispatchProps) {
        super(props);

        this.state = {
            alertHeading: 'Pending Verification',
            alertIsVisible: false,
            alertMessage: '',
            email: '',
            alertVariation: 'primary',
        };

        this.translate = (key: string, params: any) => translator('en-us', key, params);
    }

    componentDidMount() { // eslint-disable-line class-methods-use-this
        document.title = `${getWebsiteName()} | ${this.translate('pages.resetPassword.pageTitle')}`;
    }

    onSubmit = (event: any) => {
        event.preventDefault();
        VerificationCodesService.requestOneTimePassword(this.state.email)
            .then(() => {
                this.setState({
                    alertIsVisible: false,
                });
                this.setState({
                    alertIsVisible: true,
                    alertHeading: 'Email sent!',
                    alertMessage: this.translate('pages.resetPassword.successMessage'),
                    alertVariation: 'success',
                }, () => {
                    this.props.navigation.navigate('/login', {
                        state: {
                            successMessage: this.translate('pages.resetPassword.successVerifiedMessage'),
                        },
                    });
                });
            })
            .catch((error) => {
                if (error.message === 'User not found') {
                    this.setState({
                        alertIsVisible: true,
                        alertHeading: 'User Not Found',
                        alertMessage: this.translate('pages.resetPassword.failedMessageUserNotFound'),
                        alertVariation: 'warning',
                    });
                } else {
                    this.setState({
                        alertIsVisible: true,
                        alertHeading: 'User Not Found',
                        alertMessage: this.translate('pages.resetPassword.failedMessage'),
                        alertVariation: 'danger',
                    });
                }
            });
    };

    onInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        event.preventDefault();
        const { value } = event.currentTarget;

        this.setState({
            email: value,
        });
    };

    toggleAlert = (show?: boolean) => {
        this.setState({
            alertIsVisible: show !== undefined ? show : !this.state.alertIsVisible,
        });
    };

    render() {
        const {
            alertMessage,
            alertHeading,
            alertIsVisible,
            alertVariation,
        } = this.state;

        return (
            <div id="page_email_verification" className="flex-box space-evenly center row wrap-reverse">
                <main>
                    <section className='d-flex align-items-center my-5 mt-lg-6 mb-lg-5'>
                        <Container>
                            <Row className='justify-content-center form-bg-image'>
                                <Col xs={12} className='d-flex align-items-center justify-content-center'>
                                    <div className='bg-white shadow-soft border rounded border-light p-4 p-lg-5 w-100 fmxw-500' style={{ minHeight: '510px' }}>
                                        <div className='mb-4 mt-md-0'>
                                            <h3 className='text-center text-md-center mb-0'>{this.translate('pages.resetPassword.pageTitle')}</h3>
                                            <Form className='mt-4'>
                                                <Form.Group className='mb-4' controlId="user_name">
                                                    <Form.Label>{this.translate('pages.resetPassword.labels.email')}</Form.Label>
                                                    <InputGroup>
                                                        <InputGroup.Text>
                                                            <FontAwesomeIcon icon={faEnvelope} />
                                                        </InputGroup.Text>
                                                        <Form.Control
                                                            autoFocus
                                                            required
                                                            type='email'
                                                            name='email'
                                                            value={this.state.email}
                                                            onChange={this.onInputChange}
                                                            onSubmit={this.onSubmit}
                                                            placeholder={this.translate('pages.resetPassword.labels.email')}
                                                        />
                                                    </InputGroup>
                                                </Form.Group>
                                                <Button
                                                    id="verify_email"
                                                    variant='primary'
                                                    type='submit'
                                                    className='w-100'
                                                    onClick={this.onSubmit}
                                                    onSubmit={this.onSubmit}
                                                    disabled={!this.state.email}>
                                                    {this.translate('pages.resetPassword.buttons.send')}
                                                </Button>
                                            </Form>
                                            <div className="text-center mt-4">
                                                <Link to="/login">{this.translate('pages.resetPassword.returnToLogin')}</Link>
                                            </div>
                                        </div>
                                    </div>
                                </Col>
                            </Row>
                        </Container>
                    </section>
                </main>
                <ToastContainer className="p-3" position={'bottom-end'}>
                    <Toast bg={alertVariation} show={alertIsVisible && !!alertMessage} onClose={() => this.toggleAlert(false)}>
                        <Toast.Header>
                            <img src="holder.js/20x20?text=%20" className="rounded me-2" alt="" />
                            <strong className="me-auto">{alertHeading}</strong>
                            {/* <small>11 mins ago</small> */}
                        </Toast.Header>
                        <Toast.Body>{alertMessage}</Toast.Body>
                    </Toast>
                </ToastContainer>
            </div>
        );
    }
}

export default withNavigation(ResetPasswordComponent);
