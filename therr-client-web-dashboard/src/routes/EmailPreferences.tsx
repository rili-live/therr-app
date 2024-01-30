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
    FormCheck,
} from 'react-bootstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faEnvelope } from '@fortawesome/free-solid-svg-icons';
import { UsersService } from 'therr-react/services';
import translator from '../services/translator';
import * as globalConfig from '../../../global-config';
import withNavigation from '../wrappers/withNavigation';
import { getWebsiteName } from '../utilities/getHostContext';

interface IEmailPreferencesRouterProps {
    location: Location;
    navigation: {
        navigate: NavigateFunction;
    }
}

interface IEmailPreferencesDispatchProps {
// Add your dispatcher properties here
}

interface IEmailPreferencesProps extends IEmailPreferencesRouterProps, IEmailPreferencesDispatchProps {}

interface IEmailPreferencesState {
    alertHeading: string;
    alertIsVisible: boolean;
    alertMessage: string;
    alertVariation: string;
    isLoading: boolean;
    inputs: {
        settingsEmailLikes: boolean;
        settingsEmailInvites: boolean;
        settingsEmailMentions: boolean;
        settingsEmailMessages: boolean;
        settingsEmailReminders: boolean;
        settingsEmailBackground: boolean;
        settingsEmailMarketing: boolean;
        settingsEmailBusMarketing: boolean;
    };
}

// Environment Variables
const envVars = globalConfig[process.env.NODE_ENV];

/**
 * EmailPreferences
 */
export class EmailPreferencesComponent extends React.Component<IEmailPreferencesProps, IEmailPreferencesState> {
    private translate: Function;

    constructor(props: IEmailPreferencesProps & IEmailPreferencesDispatchProps) {
        super(props);

        this.state = {
            alertHeading: 'Pending Verification',
            alertIsVisible: false,
            alertMessage: '',
            isLoading: true,
            inputs: {
                settingsEmailBusMarketing: true,
                settingsEmailMarketing: true,
                settingsEmailLikes: true,
                settingsEmailInvites: true,
                settingsEmailMentions: true,
                settingsEmailMessages: true,
                settingsEmailReminders: true,
                settingsEmailBackground: true,
            },
            alertVariation: 'primary',
        };

        this.translate = (key: string, params: any) => translator('en-us', key, params);
    }

    componentDidMount() { // eslint-disable-line class-methods-use-this
        document.title = `${getWebsiteName()} | ${this.translate('pages.emailPreferences.pageTitle')}`;
        const { location } = this.props;

        const urlParams = new URLSearchParams(location?.search);

        UsersService.getSubscriptionPreferences(urlParams.get('emailToken'))
            .then((response) => {
                const {
                    settingsEmailBusMarketing,
                    settingsEmailMarketing,
                    settingsEmailLikes,
                    settingsEmailInvites,
                    settingsEmailMentions,
                    settingsEmailMessages,
                    settingsEmailReminders,
                    settingsEmailBackground,
                } = response.data;
                this.setState({
                    inputs: {
                        settingsEmailBusMarketing: !!settingsEmailBusMarketing,
                        settingsEmailMarketing: !!settingsEmailMarketing,
                        settingsEmailLikes: !!settingsEmailLikes,
                        settingsEmailInvites: !!settingsEmailInvites,
                        settingsEmailMentions: !!settingsEmailMentions,
                        settingsEmailMessages: !!settingsEmailMessages,
                        settingsEmailReminders: !!settingsEmailReminders,
                        settingsEmailBackground: !!settingsEmailBackground,
                    },
                });
            })
            .catch((error) => {
                if (error.message === 'User not found') {
                    this.setState({
                        alertIsVisible: true,
                        alertHeading: 'User Not Found',
                        alertMessage: this.translate('pages.emailPreferences.failedMessageUserNotFound'),
                        alertVariation: 'warning',
                    });
                } else {
                    this.setState({
                        alertIsVisible: true,
                        alertHeading: 'User Not Found',
                        alertMessage: this.translate('pages.emailPreferences.failedToFetchMessage'),
                        alertVariation: 'danger',
                    });
                }

                if (error?.statusCode === 401 || error?.statusCode === 403 || error?.message === 'invalid token') {
                    this.props.navigation.navigate('/login', {
                        state: {
                            errorMessage: this.translate('pages.emailPreferences.failedTokenMessage'),
                        },
                    });
                }
            })
            .finally(() => {
                this.setState({
                    isLoading: false,
                });
            });
    }

    onSubmit = (event: any) => {
        event.preventDefault();

        const { inputs } = this.state;
        const { location } = this.props;

        this.setState({
            isLoading: true,
        });

        const urlParams = new URLSearchParams(location?.search);
        UsersService.updateSubscriptionPreferences(inputs, urlParams.get('emailToken'))
            .then(() => {
                this.setState({
                    alertIsVisible: true,
                    alertHeading: 'Successfully Updated!',
                    alertMessage: this.translate('pages.emailPreferences.successMessage'),
                    alertVariation: 'success',
                });
            })
            .catch((error) => {
                if (error.message === 'User not found') {
                    this.setState({
                        alertIsVisible: true,
                        alertHeading: 'User Not Found',
                        alertMessage: this.translate('pages.emailPreferences.failedMessageUserNotFound'),
                        alertVariation: 'warning',
                    });
                } else {
                    this.setState({
                        alertIsVisible: true,
                        alertHeading: 'User Not Found',
                        alertMessage: this.translate('pages.emailPreferences.failedToUpdateMessage'),
                        alertVariation: 'danger',
                    });
                }
            })
            .finally(() => {
                this.setState({
                    isLoading: false,
                });
            });
    };

    onCheckboxChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const { name, checked } = event.currentTarget;

        const newInputChanges: any = {
            [name]: !this.state.inputs[name],
        };

        this.setState({
            alertIsVisible: false,
            inputs: {
                ...this.state.inputs,
                ...newInputChanges,
            },
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
            isLoading,
            inputs,
        } = this.state;

        return (
            <div id="page_email_preferences" className="flex-box space-evenly center row wrap-reverse">
                <main>
                    <section className='d-flex align-items-center my-5 mt-lg-6 mb-lg-5'>
                        <Container>
                            <Row className='justify-content-center form-bg-image'>
                                <Col xs={12} className='d-flex align-items-center justify-content-center'>
                                    <div className='bg-white shadow-soft border rounded border-light p-4 p-lg-5 w-100 fmxw-500' style={{ minHeight: '510px' }}>
                                        <div className='mb-4 mt-md-0'>
                                            <h3 className='text-center text-md-center mb-0'>{this.translate('pages.emailPreferences.pageTitle')}</h3>
                                            <Form className='mt-4'>
                                                <h4 className='mb-4'>
                                                    {this.translate('pages.emailPreferences.sectionHeaders.marketing')}
                                                </h4>
                                                <Form.Group className='mb-2' controlId="user_name">
                                                    <FormCheck id="settingsEmailBusMarketing" type="checkbox" className="d-flex mb-3">
                                                        <FormCheck.Input
                                                            name="settingsEmailBusMarketing"
                                                            required
                                                            className="me-2"
                                                            onChange={this.onCheckboxChange}
                                                            checked={inputs.settingsEmailBusMarketing}
                                                            disabled={isLoading}
                                                        />
                                                        <FormCheck.Label htmlFor="settingsEmailBusMarketing">
                                                            {this.translate('pages.emailPreferences.labels.settingsEmailBusMarketing')}
                                                        </FormCheck.Label>
                                                    </FormCheck>
                                                </Form.Group>
                                                <Form.Group className='mb-2' controlId="user_name">
                                                    <FormCheck id="settingsEmailMarketing" type="checkbox" className="d-flex mb-3">
                                                        <FormCheck.Input
                                                            name="settingsEmailMarketing"
                                                            required
                                                            className="me-2"
                                                            onChange={this.onCheckboxChange}
                                                            checked={inputs.settingsEmailMarketing}
                                                            disabled={isLoading}

                                                        />
                                                        <FormCheck.Label htmlFor="settingsEmailMarketing">
                                                            {this.translate('pages.emailPreferences.labels.settingsEmailMarketing')}
                                                        </FormCheck.Label>
                                                    </FormCheck>
                                                </Form.Group>

                                                <h4 className='mb-4 mt-5'>
                                                    {this.translate('pages.emailPreferences.sectionHeaders.social')}
                                                </h4>
                                                <Form.Group className='mb-2' controlId="user_name">
                                                    <FormCheck id="settingsEmailLikes" type="checkbox" className="d-flex mb-3">
                                                        <FormCheck.Input
                                                            name="settingsEmailLikes"
                                                            required
                                                            className="me-2"
                                                            onChange={this.onCheckboxChange}
                                                            checked={inputs.settingsEmailLikes}
                                                            disabled={isLoading}
                                                        />
                                                        <FormCheck.Label htmlFor="settingsEmailLikes">
                                                            {this.translate('pages.emailPreferences.labels.settingsEmailLikes')}
                                                        </FormCheck.Label>
                                                    </FormCheck>
                                                </Form.Group>
                                                <Form.Group className='mb-2' controlId="user_name">
                                                    <FormCheck id="settingsEmailInvites" type="checkbox" className="d-flex mb-3">
                                                        <FormCheck.Input
                                                            name="settingsEmailInvites"
                                                            required
                                                            className="me-2"
                                                            onChange={this.onCheckboxChange}
                                                            checked={inputs.settingsEmailInvites}
                                                            disabled={isLoading}
                                                        />
                                                        <FormCheck.Label htmlFor="settingsEmailInvites">
                                                            {this.translate('pages.emailPreferences.labels.settingsEmailInvites')}
                                                        </FormCheck.Label>
                                                    </FormCheck>
                                                </Form.Group>
                                                <Form.Group className='mb-2' controlId="user_name">
                                                    <FormCheck id="settingsEmailMentions" type="checkbox" className="d-flex mb-3">
                                                        <FormCheck.Input
                                                            name="settingsEmailMentions"
                                                            required
                                                            className="me-2"
                                                            onChange={this.onCheckboxChange}
                                                            checked={inputs.settingsEmailMentions}
                                                            disabled={isLoading}
                                                        />
                                                        <FormCheck.Label htmlFor="settingsEmailMentions">
                                                            {this.translate('pages.emailPreferences.labels.settingsEmailMentions')}
                                                        </FormCheck.Label>
                                                    </FormCheck>
                                                </Form.Group>
                                                <Form.Group className='mb-2' controlId="user_name">
                                                    <FormCheck id="settingsEmailMessages" type="checkbox" className="d-flex mb-3">
                                                        <FormCheck.Input
                                                            name="settingsEmailMessages"
                                                            required
                                                            className="me-2"
                                                            onChange={this.onCheckboxChange}
                                                            checked={inputs.settingsEmailMessages}
                                                            disabled={isLoading}
                                                        />
                                                        <FormCheck.Label htmlFor="settingsEmailMessages">
                                                            {this.translate('pages.emailPreferences.labels.settingsEmailMessages')}
                                                        </FormCheck.Label>
                                                    </FormCheck>
                                                </Form.Group>
                                                <Form.Group className='mb-2' controlId="user_name">
                                                    <FormCheck id="settingsEmailReminders" type="checkbox" className="d-flex mb-3">
                                                        <FormCheck.Input
                                                            name="settingsEmailReminders"
                                                            required
                                                            className="me-2"
                                                            onChange={this.onCheckboxChange}
                                                            checked={inputs.settingsEmailReminders}
                                                            disabled={isLoading}
                                                        />
                                                        <FormCheck.Label htmlFor="settingsEmailReminders">
                                                            {this.translate('pages.emailPreferences.labels.settingsEmailReminders')}
                                                        </FormCheck.Label>
                                                    </FormCheck>
                                                </Form.Group>
                                                <Form.Group className='mb-5' controlId="user_name">
                                                    <FormCheck id="settingsEmailBackground" type="checkbox" className="d-flex mb-3">
                                                        <FormCheck.Input
                                                            name="settingsEmailBackground"
                                                            required
                                                            className="me-2"
                                                            onChange={this.onCheckboxChange}
                                                            checked={inputs.settingsEmailBackground}
                                                            disabled={isLoading}
                                                        />
                                                        <FormCheck.Label htmlFor="settingsEmailBackground">
                                                            {this.translate('pages.emailPreferences.labels.settingsEmailBackground')}
                                                        </FormCheck.Label>
                                                    </FormCheck>
                                                </Form.Group>
                                                <Button
                                                    id="verify_email"
                                                    variant='primary'
                                                    type='submit'
                                                    className='w-100'
                                                    onClick={this.onSubmit}
                                                    onSubmit={this.onSubmit}
                                                    disabled={isLoading}>
                                                    {this.translate('pages.emailPreferences.buttons.send')}
                                                </Button>
                                            </Form>
                                            <div className="text-center mt-4">
                                                <Link to="/login">{this.translate('pages.emailPreferences.returnToLogin')}</Link>
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

export default withNavigation(EmailPreferencesComponent);
