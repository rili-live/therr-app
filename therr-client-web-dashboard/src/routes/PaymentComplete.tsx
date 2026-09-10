import * as React from 'react';
import ReactGA from 'react-ga4';
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

const PURCHASE_REPORTED_KEY_PREFIX = 'therrPurchaseReported:';

/**
 * The funnel's conversion event, and the reason this whole page matters to
 * marketing: before Stripe checkout returned here in the same tab, the GA4
 * session ended at the "Upgrade" click and no `purchase` existed in any
 * property. See docs/MARKETING_ATTRIBUTION_PLAN.md, Phase 2.
 *
 * Deduplicated on the Stripe session id. This route is a plain URL that stays
 * in browser history, so a back-navigation or a refresh re-mounts it — and a
 * double-counted purchase overstates revenue in a way nothing downstream can
 * detect or correct.
 */
const reportPurchase = (sessionId: string, data: any): void => {
    if (!sessionId) return;

    const storageKey = `${PURCHASE_REPORTED_KEY_PREFIX}${sessionId}`;

    try {
        if (window.sessionStorage.getItem(storageKey)) return;
        window.sessionStorage.setItem(storageKey, '1');
    } catch {
        // Storage unavailable (private browsing). Reporting an occasional
        // duplicate beats losing the only conversion event we have.
    }

    ReactGA.event('purchase', {
        transaction_id: sessionId,
        value: data?.value,
        currency: data?.currency || 'USD',
        items: [{
            item_id: data?.plan || (data?.productIds || [])[0],
            item_name: data?.plan,
            item_category: data?.billingPeriod,
            price: data?.value,
            quantity: 1,
        }],
    });
};

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

    componentDidMount() {
        const {
            getMe, location, routeParams, user,
        } = this.props;
        const { sessionId } = routeParams;
        document.title = `${getWebsiteName()} | ${this.translate('pages.paymentComplete.pageTitle')}`;

        const queryParams = new URLSearchParams(location.search);

        // Called whether or not the buyer is signed in. The endpoint resolves
        // the session's billing email against an account and fails closed when
        // they do not match, so an anonymous return grants nothing — it just
        // yields the order details the `purchase` event needs. Buy-then-
        // register is a supported path, and it is the one most likely to be
        // driven by a campaign, so leaving it unmeasured would blind the loop
        // to exactly the conversions it exists to attribute.
        UsersService.activateSubscription(sessionId).then(({ data }) => {
            reportPurchase(sessionId, data);

            if (!user.isAuthenticated) {
                // Nothing to navigate to — the render below offers sign-up and
                // sign-in links that carry the session id forward.
                return;
            }

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
            if (!user.isAuthenticated) {
                // An anonymous visitor was never shown a result here; keep it
                // that way rather than surfacing an error for a call they did
                // not knowingly make.
                return;
            }
            this.setState({
                alertIsVisible: true,
                alertHeading: 'Unknown Error',
                alertVariation: 'danger',
                alertMessage: this.translate('pages.paymentComplete.failedMessage'),
            });
        });
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
