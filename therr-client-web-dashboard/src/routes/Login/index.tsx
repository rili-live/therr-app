import React from 'react';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import { Location, NavigateFunction, Link } from 'react-router-dom';
import LogRocket from 'logrocket';
import { IUserState } from 'therr-react/types';
import {
    Col,
    Row,
    Card,
    Container,
    Toast,
    ToastContainer,
    ToastProps,
    Button,
} from 'react-bootstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faFacebookF, faGithub, faTwitter } from '@fortawesome/free-brands-svg-icons';
import { v4 as uuidv4 } from 'uuid';
import LoginForm from './LoginForm';
import translator from '../../services/translator';
import UsersActions from '../../redux/actions/UsersActions';
import withNavigation from '../../wrappers/withNavigation';
import { getWebsiteName } from '../../utilities/getHostContext';

const BgImage = '/assets/img/illustrations/signin-v2.svg';

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
    alertHeading: string;
    alertMessage: string;
    alertVariation: ToastProps['bg'];
    alertIsVisible: boolean;
    inputs: any;
    requestId: string;
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

        const { location } = props;

        this.state = {
            alertHeading: 'Success!',
            alertMessage: (location.state as any)?.successMessage || '',
            alertVariation: 'success',
            alertIsVisible: location.state && (location.state as any).successMessage,
            inputs: {},
            requestId: uuidv4().toString(),
        };

        this.translate = (key: string, params: any) => translator('en-us', key, params);
    }

    componentDidMount() { // eslint-disable-line class-methods-use-this
        document.title = `${getWebsiteName()} | ${this.translate('pages.login.pageTitle')}`;
    }

    toggleAlert = (show?: boolean, alertHeading = 'Success!', alertVariation: ToastProps['bg'] = 'success', alertMessage = '') => {
        const alertIsVisible = show !== undefined ? show : !this.state.alertIsVisible;
        if (!alertIsVisible) {
            this.setState({
                alertIsVisible,
            });
        } else {
            this.setState({
                alertIsVisible,
                alertHeading,
                alertVariation,
                alertMessage: alertMessage || this.state.alertMessage,
            });
        }
    };

    login = (credentials: any) => this.props.login(credentials);

    // eslint-disable-next-line class-methods-use-this
    onFBLoginPress = () => {
        const { requestId } = this.state;
        // TODO: Use scopes needed for meta ads/campaigns
        const scopes = [
            'email',
            'public_profile',
            'instagram_basic',
            //
            'ads_management',
            'pages_show_list',
            'pages_read_engagement',
            //
            'ads_read',
            // //
            'pages_manage_ads',
            'pages_show_list',
            // //
            'read_insights',
            'instagram_manage_insights',
            // 'instagram_graph_user_profile',
        ];
        // const redirectUri = 'https://api.therr.com/v1/users-service/social-sync/oauth2-dashboard-facebook';
        const redirectUri = 'https://dashboard.therr.com/oauth2/facebook-instagram';
        const responseType = 'code';
        const appId = '1384683965734062';
        // eslint-disable-next-line max-len
        const authUrl = `https://www.facebook.com/v18.0/dialog/oauth?client_id=${appId}&redirect_uri=${redirectUri}&response_type=${responseType}&scope=${scopes.join(',')}&state=${requestId}`;
        window?.open(authUrl);
    };

    public render(): JSX.Element | null {
        const {
            alertHeading,
            alertMessage,
            alertIsVisible,
            alertVariation,
        } = this.state;

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
                                            <h3 className='mb-0'>{this.translate('pages.login.pageHeader')}</h3>
                                        </div>
                                        {/* <div className='text-center text-md-center mb-4 mt-md-0'>
                                            <h3 className='mb-0'>{this.translate('pages.login.pageSubheader')}</h3>
                                        </div> */}
                                        <LoginForm
                                            login={this.login}
                                            alert={alertMessage}
                                            toggleAlert={this.toggleAlert}
                                        />
                                        <div className="mt-3 mb-4 text-center">
                                            <span className="fw-normal">or login with</span>
                                        </div>
                                        <div className='d-flex justify-content-center my-4'>
                                            <Button variant='outline-light' className='btn-icon-only btn-pill text-facebook me-2' onClick={this.onFBLoginPress}>
                                                <FontAwesomeIcon icon={faFacebookF} />
                                            </Button>
                                            {/* <Button variant='outline-light' className='btn-icon-only btn-pill text-twitter me-2'>
                                                <FontAwesomeIcon icon={faTwitter} />
                                            </Button>
                                            <Button variant='outline-light' className='btn-icon-only btn-pil text-dark'>
                                                <FontAwesomeIcon icon={faGithub} />
                                            </Button> */}
                                        </div>
                                        <div className='d-flex justify-content-center align-items-center mt-4'>
                                            <span className='fw-normal'>
                                                {/* eslint-disable-next-line no-trailing-spaces */}
                                                Not registered? 
                                                <Card.Link as={Link} to={'/register'} className='fw-bold' style={{ paddingLeft: '.5rem' }}>
                                                    {'Create account'}
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

export default withNavigation(connect(mapStateToProps, mapDispatchToProps)(LoginComponent));
