import React from 'react';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import { Location, NavigateFunction, Link } from 'react-router-dom';
import LogRocket from 'logrocket';
import { IUserState } from 'therr-react/types';
import {
    FontAwesomeIcon,
} from '@fortawesome/react-fontawesome';
import {
    faAngleLeft,
    faEnvelope,
    faUnlockAlt,
} from '@fortawesome/free-solid-svg-icons';
import {
    faFacebookF,
    faGithub,
    faTwitter,
} from '@fortawesome/free-brands-svg-icons';
import {
    Col,
    Row,
    Form,
    Card,
    Button,
    FormCheck,
    Container,
    InputGroup,
} from '@themesberg/react-bootstrap';
import LoginForm from './LoginForm';
import translator from '../../services/translator';
import UsersActions from '../../redux/actions/UsersActions';
import withNavigation from '../../wrappers/withNavigation';

const BgImage = '/assets/img/illustrations/signin.svg';

export const shouldRenderLoginForm = (props: ILoginProps) => !props.user
    || !props.user.isAuthenticated
    || !props.user.details.accessLevels
    || !props.user.details.accessLevels.length;

export const routeAfterLogin = '/dashboard';

interface ILoginRouterProps {
    location: Location;
    navigation: {
        navigate: NavigateFunction;
    }
}

interface ILoginDispatchProps {
    login: Function;
}

interface IStoreProps extends ILoginDispatchProps {
    user: IUserState;
}

// Regular component props
export interface ILoginProps extends ILoginRouterProps, IStoreProps {
}

interface ILoginState {
    inputs: any;
}

const mapStateToProps = (state: any) => ({
    user: state.user,
});

const mapDispatchToProps = (dispatch: any) => bindActionCreators({
    login: UsersActions.login,
}, dispatch);

/**
 * Login
 */
export class LoginComponent extends React.Component<ILoginProps, ILoginState> {
    private translate: Function;

    static getDerivedStateFromProps(nextProps: ILoginProps) {
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

    constructor(props: ILoginProps) {
        super(props);

        this.state = {
            inputs: {},
        };

        this.translate = (key: string, params: any) => translator('en-us', key, params);
    }

    componentDidMount() { // eslint-disable-line class-methods-use-this
        document.title = `Therr for Business | ${this.translate('pages.login.pageTitle')}`;
    }

    login = (credentials: any) => this.props.login(credentials);

    public render(): JSX.Element | null {
        const { location } = this.props;
        const alertSuccessMessage = location.state && (location.state as any).successMessage;

        return (
            <div id="page_login" className="flex-box center space-evenly row">
                <main>
                    <section className='d-flex align-items-center my-5 mt-lg-6 mb-lg-5'>
                        <Container>
                            {/* <p className='text-center'>
                                <Card.Link as={Link} to={'/'} className='text-gray-700'>
                                    <FontAwesomeIcon icon={faAngleLeft} className='me-2' /> Back to homepage
                                </Card.Link>
                            </p> */}
                            <Row className='justify-content-center form-bg-image' style={{ backgroundImage: `url(${BgImage})` }}>
                                <Col xs={12} className='d-flex align-items-center justify-content-center'>
                                    <div className='bg-white shadow-soft border rounded border-light p-4 p-lg-5 w-100 fmxw-500' style={{ minHeight: '510px' }}>
                                        <div className='text-center text-md-center mb-4 mt-md-0'>
                                            <h3 className='mb-0'>{this.translate('pages.login.pageHeader')}</h3>
                                        </div>
                                        <LoginForm
                                            login={this.login}
                                            alert={alertSuccessMessage}
                                        />

                                        {/* <div className='mt-3 mb-4 text-center'>
                                            <span className='fw-normal'>or login with</span>
                                        </div>
                                        <div className='d-flex justify-content-center my-4'>
                                            <Button variant='outline-light' className='btn-icon-only btn-pill text-facebook me-2'>
                                                <FontAwesomeIcon icon={faFacebookF} />
                                            </Button>
                                            <Button variant='outline-light' className='btn-icon-only btn-pill text-twitter me-2'>
                                                <FontAwesomeIcon icon={faTwitter} />
                                            </Button>
                                            <Button variant='outline-light' className='btn-icon-only btn-pil text-dark'>
                                                <FontAwesomeIcon icon={faGithub} />
                                            </Button>
                                        </div> */}
                                        {/* <div className='d-flex justify-content-center align-items-center mt-4'>
                                            <span className='fw-normal'>
                                                Not registered?
                                                <Card.Link as={Link} to={'/'} className='fw-bold'>
                                                    {'Create account'}
                                                </Card.Link>
                                            </span>
                                        </div> */}
                                    </div>
                                </Col>
                            </Row>
                        </Container>
                    </section>
                </main>
            </div>
        );
    }
}

export default withNavigation(connect(mapStateToProps, mapDispatchToProps)(LoginComponent));