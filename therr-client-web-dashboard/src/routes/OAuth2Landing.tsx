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
import LoginForm from './Login/LoginForm';
import translator from '../services/translator';
import UsersActions from '../redux/actions/UsersActions';
import withNavigation from '../wrappers/withNavigation';
import { getWebsiteName } from '../utilities/getHostContext';
import { shouldRenderLoginForm } from '../api/login';
import { routeAfterLogin } from './Login';

const BgImage = '/assets/img/illustrations/signin-v2.svg';

interface IOAuth2LandingRouterProps {
    location: Location;
    navigation: {
        navigate: NavigateFunction;
    }
}

interface IOAuth2LandingDispatchProps {
    login: Function;
}

interface IStoreProps extends IOAuth2LandingDispatchProps {
    user: IUserState;
}

// Regular component props
export interface IOAuth2LandingProps extends IOAuth2LandingRouterProps, IStoreProps {
}

interface IOAuth2LandingState {
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
 * OAuth2Landing
 */
export class OAuth2LandingComponent extends React.Component<IOAuth2LandingProps, IOAuth2LandingState> {
    private translate: Function;

    static getDerivedStateFromProps(nextProps: IOAuth2LandingProps) {
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

    constructor(props: IOAuth2LandingProps) {
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
                                <Col xs={12} className='d-flex align-items-center justify-content-center' style={{ minHeight: '50vh' }}>
                                    <p>Authenticating...</p>
                                </Col>
                            </Row>
                        </Container>
                    </section>
                </main>
            </div>
        );
    }
}

export default withNavigation(connect(mapStateToProps, mapDispatchToProps)(OAuth2LandingComponent));
