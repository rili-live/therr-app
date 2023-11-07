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
    Button,
} from 'react-bootstrap';
import LogRocket from 'logrocket';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faFacebookF } from '@fortawesome/free-brands-svg-icons';
import Toast from 'react-bootstrap/Toast';
import { v4 as uuidv4 } from 'uuid';
import { IUserState } from 'therr-react/types';
import translator from '../../services/translator';
import RegisterForm from './RegisterForm';
import UsersActions from '../../redux/actions/UsersActions';
import withNavigation from '../../wrappers/withNavigation';
import { getWebsiteName } from '../../utilities/getHostContext';
import { onFBLoginPress, shouldRenderLoginForm } from '../../api/login';
import { routeAfterLogin } from '../Login';
import LoginWith from '../../components/LoginWith';

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
    user: IUserState;
}

interface IRegisterState {
    alertIsVisible: boolean;
    alertMessage: string;
    requestId: string;
}

const mapStateToProps = (state: any) => ({
    user: state.user,
});

const mapDispatchToProps = (dispatch: any) => bindActionCreators({
    register: UsersActions.register,
}, dispatch);

/**
 * Login
 */
export class RegisterComponent extends React.Component<IRegisterProps, IRegisterState> {
    private translate: Function;

    static getDerivedStateFromProps(nextProps: IRegisterProps) {
        // TODO: Choose route based on accessLevels
        if (!shouldRenderLoginForm(nextProps)) {
            LogRocket.identify(nextProps.user.details.id, {
                name: `${nextProps.user.details.firstName} ${nextProps.user.details.lastName}`,
                email: nextProps.user.details.email,
                // Add your own custom user variables below:
            });
            // TODO: This doesn't seem to work with react-router-dom v6 after a newly created user tries to login
            // Causes a flicker / Need to investigate further
            setTimeout(() => nextProps.navigation.navigate(routeAfterLogin));
            return null;
        }
        return {};
    }

    constructor(props: IRegisterProps) {
        super(props);

        this.state = {
            alertIsVisible: false,
            alertMessage: '',
            requestId: uuidv4().toString(),
        };

        this.translate = (key: string, params: any) => translator('en-us', key, params);
    }

    componentDidMount() { // eslint-disable-line class-methods-use-this
        document.title = `${getWebsiteName()} | ${this.translate('pages.register.pageTitle')}`;
    }

    onOauth2Press = (provider: string) => {
        const { requestId } = this.state;

        switch (provider) {
            case 'facebook':
                onFBLoginPress(requestId);
                break;
            default:
                break;
        }
    };

    register = (credentials: any) => {
        this.props.register({
            ...credentials,
            email: credentials.email,
            password: credentials.password,
            website: credentials.website,
            isBusinessAccount: true,
            isCreatorAccount: false,
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
            <div id="page_register" className="flex-box center space-evenly row">
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

                                        <div className="mt-3 mb-4 text-center">
                                            <span className="fw-normal">or continue with</span>
                                        </div>
                                        <LoginWith
                                            onClick={this.onOauth2Press}
                                        />
                                        <div className="d-flex justify-content-center align-items-center mt-4">
                                            <span className="fw-normal">
                                                Already have an account?
                                                <Card.Link as={Link} to={'/login'} className="fw-bolder">
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
