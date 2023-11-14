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
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import { IUserState } from 'therr-react/types';
import { UsersService } from 'therr-react/services';
import translator from '../services/translator';
import * as globalConfig from '../../../global-config';
import VerificationCodesService from '../services/VerificationCodesService';
import withNavigation from '../wrappers/withNavigation';
import { getWebsiteName } from '../utilities/getHostContext';
import UsersActions from '../redux/actions/UsersActions';

interface IPaymentCompleteRouterProps {
    location: Location;
    navigation: {
        navigate: NavigateFunction;
    };
    routeParams: any;
}

interface IPaymentCompleteDispatchProps {
    getMe: Function;
}

interface IPaymentCompleteProps extends IPaymentCompleteRouterProps, IPaymentCompleteDispatchProps {
    user: IUserState;
}

interface IPaymentCompleteState {
    alertHeading: string;
    alertIsVisible: boolean;
    alertMessage: string;
    email: string;
    alertVariation: string;
}

// Environment Variables
const envVars = globalConfig[process.env.NODE_ENV];

const mapStateToProps = (state: any) => ({
    user: state.user,
});

const mapDispatchToProps = (dispatch: any) => bindActionCreators({
    getMe: UsersActions.getMe,
}, dispatch);

/**
 * PaymentComplete
 */
export class PaymentCompleteComponent extends React.Component<IPaymentCompleteProps, IPaymentCompleteState> {
    private translate: Function;

    constructor(props: IPaymentCompleteProps & IPaymentCompleteDispatchProps) {
        super(props);

        this.state = {
            alertHeading: 'Pending Verification',
            alertIsVisible: false,
            alertMessage: '...loading',
            email: '',
            alertVariation: 'primary',
        };

        this.translate = (key: string, params: any) => translator('en-us', key, params);
    }

    componentDidMount() { // eslint-disable-line class-methods-use-this
        const {
            getMe, location, routeParams, user,
        } = this.props;
        const { sessionId } = routeParams;
        document.title = `${getWebsiteName()} | ${this.translate('pages.paymentComplete.pageTitle')}`;

        const queryParams = new URLSearchParams(location.search);
        if (user.isAuthenticated) {
            UsersService.activateSubscription(sessionId).then(({ data }) => {
                this.setState({
                    alertIsVisible: true,
                    alertHeading: 'Verification Success!',
                    alertMessage: this.translate('pages.paymentComplete.successMessage'),
                    alertVariation: 'success',
                }, () => {
                    getMe(); // Updates user accessLevels in redux
                    this.props.navigation.navigate('/dashboard', {
                        state: {
                            successMessage: this.translate('pages.paymentComplete.successVerifiedMessage'),
                        },
                    });
                });
            }).catch((error) => {
                this.setState({
                    alertIsVisible: true,
                    alertHeading: 'Unknown Error',
                    alertVariation: 'danger',
                    alertMessage: this.translate('pages.paymentComplete.failedMessage'),
                });
            });
        }
    }

    onSubmit = (event: any) => {
        const { sessionId } = this.props.routeParams;
        event.preventDefault();
        this.props.navigation.navigate(`/register?paymentSessionId=${sessionId}`, {
            state: {
                successMessage: this.translate('pages.paymentComplete.successVerifiedMessage'),
            },
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
        const { routeParams, user } = this.props;
        const { sessionId } = routeParams;

        return (
            <div id="page_payment_complete" className="flex-box space-evenly center row wrap-reverse">
                <main>
                    <section className='d-flex align-items-center my-5 mt-lg-6 mb-lg-5'>
                        <Container>
                            <Row className='justify-content-center form-bg-image'>
                                <Col xs={12} className='d-flex align-items-center justify-content-center'>
                                    <div className='bg-white shadow-soft border rounded border-light p-4 p-lg-5 w-100 fmxw-500' style={{ minHeight: '510px' }}>
                                        <div className='mb-4 mt-md-0'>
                                            <h3 className='text-center text-md-center mb-0'>{this.translate('pages.paymentComplete.pageTitle')}</h3>
                                            {
                                                !user.isAuthenticated && alertVariation !== 'success' && alertVariation !== 'pending'
                                                && <Form className='mt-4'>
                                                    <Button
                                                        id="sign_up"
                                                        variant='primary'
                                                        type='submit'
                                                        className='w-100'
                                                        onClick={this.onSubmit}
                                                        onSubmit={this.onSubmit}>
                                                        {this.translate('pages.paymentComplete.buttons.send')}
                                                    </Button>
                                                </Form>
                                            }
                                            {
                                                !user.isAuthenticated && <div className="text-center mt-4">
                                                    <Link
                                                        to={`/login?paymentSessionId=${sessionId}`}
                                                        state={{
                                                            successMessage: this.translate('pages.paymentComplete.successVerifiedMessage'),
                                                        }}
                                                    >{this.translate('pages.paymentComplete.returnToLogin')}</Link>
                                                </div>
                                            }
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

export default withNavigation(connect(mapStateToProps, mapDispatchToProps)(PaymentCompleteComponent));
