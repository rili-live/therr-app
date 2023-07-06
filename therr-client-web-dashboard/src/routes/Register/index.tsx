import * as React from 'react';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import { Link, NavigateFunction } from 'react-router-dom';
import {
    Col,
    Row,
    Card,
    Container,
    ToastContainer,
} from 'react-bootstrap';
import Toast from 'react-bootstrap/Toast';
import translator from '../../services/translator';
import RegisterForm from './RegisterForm';
import UsersActions from '../../redux/actions/UsersActions';
import withNavigation from '../../wrappers/withNavigation';

const BgImage = '/assets/img/illustrations/signin-v2.svg';

interface IRegisterRouterProps {
    navigation: {
        navigate: NavigateFunction;
    }
}

interface IRegisterDispatchProps {
    register: Function;
}

type IStoreProps = IRegisterDispatchProps

// Regular component props
interface IRegisterProps extends IRegisterRouterProps, IStoreProps {
}

interface IRegisterState {
    alertIsVisible: boolean;
    alertMessage: string;
}

const mapStateToProps = (state: any) => ({
});

const mapDispatchToProps = (dispatch: any) => bindActionCreators({
    register: UsersActions.register,
}, dispatch);

/**
 * Login
 */
export class RegisterComponent extends React.Component<IRegisterProps, IRegisterState> {
    private translate: Function;

    constructor(props: IRegisterProps) {
        super(props);

        this.state = {
            alertIsVisible: false,
            alertMessage: '',
        };

        this.translate = (key: string, params: any) => translator('en-us', key, params);
    }

    componentDidMount() { // eslint-disable-line class-methods-use-this
        document.title = `Therr | ${this.translate('pages.register.pageTitle')}`;
    }

    register = (credentials: any) => {
        this.props.register({
            ...credentials,
            email: credentials.email,
            password: credentials.password,
            website: credentials.website,
            isBusinessAccount: true,
            isDashboardRegistration: true,
        }).then((response: any) => {
            this.props.navigation.navigate('/login', {
                state: {
                    successMessage: this.translate('pages.register.registerSuccess'),
                },
            });
        }).catch((error: any) => {
            if (error.statusCode === 400) {
                this.setState({
                    alertMessage: error.message,
                });
            } else {
                this.setState({
                    alertMessage: this.translate('pages.register.registerError'),
                });
            }
            this.toggleAlert(true);
        });
    };

    toggleAlert = (show?: boolean) => {
        this.setState({
            alertIsVisible: show !== undefined ? show : !this.state.alertIsVisible,
        });
    };

    onValidationError = (errMsg: string) => {
        this.setState({
            alertMessage: errMsg,
        });
        this.toggleAlert(true);
    };

    public render(): JSX.Element | null {
        const { alertIsVisible, alertMessage } = this.state;

        return (
            <div id="page_login" className="flex-box center space-evenly row">
                <main>
                    <section className='d-flex align-items-center my-5 mt-lg-7 mb-lg-5'>
                        <Container>
                            {/* <p className='text-center'>
                                <Card.Link as={Link} to={'/'} className='text-gray-700'>
                                    <FontAwesomeIcon icon={faAngleLeft} className='me-2' /> Back to homepage
                                </Card.Link>
                            </p> */}
                            <Row className='justify-content-center form-bg-image' style={{ backgroundImage: `url(${BgImage})` }}>
                                <Col xs={12} className='d-flex align-items-center justify-content-center'>
                                    <div className='bg-white shadow-soft border rounded border-light p-4 p-lg-5 w-100 fmxw-500' style={{ minHeight: '510px' }}>
                                        <div className='text-center text-md-center mb-2 mt-md-0'>
                                            <h3 className='mb-0'>{this.translate('pages.register.pageHeader')}</h3>
                                        </div>
                                        <div className='text-center text-md-center mb-4 mt-md-0'>
                                            <h3 className='mb-0'>{this.translate('pages.register.pageSubheader')}</h3>
                                        </div>
                                        <RegisterForm
                                            onValidate={this.onValidationError}
                                            register={this.register}
                                        />

                                        {/* <div className="mt-3 mb-4 text-center">
                                            <span className="fw-normal">or</span>
                                        </div>
                                        <div className="d-flex justify-content-center my-4">
                                            <Button variant="outline-light" className="btn-icon-only btn-pill text-facebook me-2">
                                                <FontAwesomeIcon icon={faFacebookF} />
                                            </Button>
                                            <Button variant="outline-light" className="btn-icon-only btn-pill text-twitter me-2">
                                                <FontAwesomeIcon icon={faTwitter} />
                                            </Button>
                                            <Button variant="outline-light" className="btn-icon-only btn-pil text-dark">
                                                <FontAwesomeIcon icon={faGithub} />
                                            </Button>
                                        </div> */}
                                        <div className="d-flex justify-content-center align-items-center mt-4">
                                            <span className="fw-normal">
                                                Already have an account?
                                                <Card.Link as={Link} to={'/login'} className="fw-bold">
                                                    {' Login here '}
                                                </Card.Link>
                                            </span>
                                        </div>
                                    </div>
                                </Col>
                            </Row>
                        </Container>
                    </section>
                </main>
                <ToastContainer className="p-3" position={'bottom-end'}>
                    <Toast bg="danger" show={alertIsVisible} onClose={() => this.toggleAlert(false)}>
                        <Toast.Header>
                            <img src="holder.js/20x20?text=%20" className="rounded me-2" alt="" />
                            <strong className="me-auto">Oops! Something went wrong.</strong>
                            {/* <small>11 mins ago</small> */}
                        </Toast.Header>
                        <Toast.Body>{alertMessage}</Toast.Body>
                    </Toast>
                </ToastContainer>
            </div>
        );
    }
}

export default withNavigation(connect(mapStateToProps, mapDispatchToProps)(RegisterComponent));
