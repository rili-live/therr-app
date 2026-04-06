import React from 'react';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import { NavigateFunction } from 'react-router-dom';
import {
    Alert,
    Badge,
    Button,
    ButtonGroup,
    Card,
    Col,
    Form,
    ProgressBar,
    Row,
    Toast,
    ToastContainer,
} from 'react-bootstrap';
import { MapActions } from 'therr-react/redux/actions';
import { UsersService } from 'therr-react/services';
import {
    IUserState,
    AccessCheckType,
} from 'therr-react/types';
import {
    AccessLevels,
    IncentiveRequirementKeys,
    IncentiveRewardKeys,
    CurrentCheckInValuations,
} from 'therr-js-utilities/constants';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faCheckCircle,
    faCoins,
    faGift,
    faLock,
    faTag,
} from '@fortawesome/free-solid-svg-icons';
import translator from '../../services/translator';
import withNavigation from '../../wrappers/withNavigation';
import ManageRewardsMenu from '../../components/ManageRewardsMenu';
import PricingCards from '../../components/PricingCards';
import { ISpace } from '../../types';
import { getWebsiteName } from '../../utilities/getHostContext';

const COIN_PER_CHECKIN = CurrentCheckInValuations[1];
const COIN_USD_RATE = 0.01; // ~1 cent per coin

interface ICreateEditRewardRouterProps {
    location: {
        state?: {
            space?: ISpace;
        };
    };
    routeParams: {
        spaceId?: string;
    };
    navigation: {
        navigate: NavigateFunction;
    };
}

interface ICreateEditRewardDispatchProps {
    getSpaceDetails: Function;
    updateSpace: Function;
}

interface IStoreProps extends ICreateEditRewardDispatchProps {
    user: IUserState;
}

interface ICreateEditRewardProps extends ICreateEditRewardRouterProps, IStoreProps {}

interface ICreateEditRewardState {
    alertIsVisible: boolean;
    alertVariation: string;
    alertTitle: string;
    alertMessage: string;
    currentStep: number;
    fetchedSpace: ISpace | null;
    isSubmitting: boolean;
    isLoadingSpace: boolean;
    inputs: {
        featuredIncentiveKey: string;
        featuredIncentiveRewardKey: string;
        isActive: boolean;
    };
    showUpgradeModal: boolean;
}

const mapStateToProps = (state: any) => ({
    user: state.user,
});

const mapDispatchToProps = (dispatch: any) => bindActionCreators({
    getSpaceDetails: MapActions.getSpaceDetails,
    updateSpace: MapActions.updateSpace,
}, dispatch);

export class CreateEditRewardComponent extends React.Component<ICreateEditRewardProps, ICreateEditRewardState> {
    private translate: Function;

    constructor(props: ICreateEditRewardProps) {
        super(props);

        const { space } = props.location?.state || {};

        this.state = {
            alertIsVisible: false,
            alertVariation: 'success',
            alertTitle: '',
            alertMessage: '',
            currentStep: 1,
            fetchedSpace: space || null,
            isSubmitting: false,
            isLoadingSpace: false,
            inputs: {
                featuredIncentiveKey: space?.featuredIncentiveKey || IncentiveRequirementKeys.VISIT_A_SPACE,
                featuredIncentiveRewardKey: space?.featuredIncentiveRewardKey || IncentiveRewardKeys.THERR_COIN_REWARD,
                isActive: !!space?.featuredIncentiveKey,
            },
            showUpgradeModal: false,
        };

        this.translate = (key: string, params?: any) => translator('en-us', key, params);
    }

    componentDidMount() {
        document.title = `${getWebsiteName()} | ${this.translate('pages.createEditReward.pageTitle')}`;

        const { getSpaceDetails, routeParams, location } = this.props;
        const { space } = location?.state || {};
        const spaceId = space?.id || routeParams?.spaceId;

        if (spaceId) {
            this.setState({ isLoadingSpace: true });
            getSpaceDetails(spaceId, { withMedia: true }).then((data) => {
                const fetchedSpace = { ...space, ...data?.space };
                this.setState({
                    fetchedSpace,
                    inputs: {
                        featuredIncentiveKey: fetchedSpace.featuredIncentiveKey || IncentiveRequirementKeys.VISIT_A_SPACE,
                        featuredIncentiveRewardKey: fetchedSpace.featuredIncentiveRewardKey || IncentiveRewardKeys.THERR_COIN_REWARD,
                        isActive: !!fetchedSpace.featuredIncentiveKey,
                    },
                });
            }).catch(() => {}).finally(() => {
                this.setState({ isLoadingSpace: false });
            });
        }
    }

    navigateHandler = (routeName: string) => () => this.props.navigation.navigate(routeName);

    isSubscribed = () => {
        const { user } = this.props;
        return UsersService.isAuthorized(
            {
                type: AccessCheckType.ANY,
                levels: [
                    AccessLevels.DASHBOARD_SUBSCRIBER_BASIC,
                    AccessLevels.DASHBOARD_SUBSCRIBER_PREMIUM,
                    AccessLevels.DASHBOARD_SUBSCRIBER_PRO,
                    AccessLevels.DASHBOARD_SUBSCRIBER_AGENCY,
                ],
            },
            user,
        );
    };

    onInputChange = (name: string, value: any) => {
        this.setState((prev) => ({
            inputs: { ...prev.inputs, [name]: value },
        }));
    };

    onNextStep = () => {
        this.setState((prev) => ({ currentStep: Math.min(prev.currentStep + 1, 3) }));
    };

    onPrevStep = () => {
        this.setState((prev) => ({ currentStep: Math.max(prev.currentStep - 1, 1) }));
    };

    onSelectLockedReward = () => {
        this.setState({ showUpgradeModal: true });
    };

    onSave = () => {
        const { fetchedSpace, inputs } = this.state;
        const { updateSpace } = this.props;

        if (!fetchedSpace?.id) return;

        this.setState({ isSubmitting: true });

        const updatePayload = inputs.isActive
            ? {
                ...fetchedSpace,
                featuredIncentiveKey: inputs.featuredIncentiveKey,
                featuredIncentiveValue: 1,
                featuredIncentiveRewardKey: inputs.featuredIncentiveRewardKey,
                featuredIncentiveRewardValue: COIN_PER_CHECKIN,
                featuredIncentiveCurrencyId: 'therr-coin',
            }
            : {
                ...fetchedSpace,
                featuredIncentiveKey: null,
                featuredIncentiveValue: null,
                featuredIncentiveRewardKey: null,
                featuredIncentiveRewardValue: null,
                featuredIncentiveCurrencyId: null,
            };

        updateSpace(fetchedSpace.id, updatePayload).then(() => {
            this.setState({
                alertTitle: 'Success!',
                alertMessage: this.translate('pages.createEditReward.successMessage'),
                alertVariation: 'success',
                alertIsVisible: true,
            });
            setTimeout(() => {
                this.props.navigation.navigate('/rewards');
            }, 1800);
        }).catch(() => {
            this.setState({
                alertTitle: 'Error',
                alertMessage: 'Failed to save reward. Please try again.',
                alertVariation: 'danger',
                alertIsVisible: true,
            });
        }).finally(() => {
            this.setState({ isSubmitting: false });
        });
    };

    toggleAlert = (show?: boolean) => {
        this.setState({
            alertIsVisible: show !== undefined ? show : !this.state.alertIsVisible,
        });
    };

    renderStep1 = () => {
        const { inputs } = this.state;

        const options = [
            {
                key: IncentiveRequirementKeys.VISIT_A_SPACE,
                label: 'Customer visits your business',
                description: 'Reward customers when they physically check in to your location.',
                icon: faCheckCircle,
                available: true,
            },
            {
                key: IncentiveRequirementKeys.SHARE_A_MOMENT,
                label: 'Customer shares a photo',
                description: 'Reward customers when they post a photo moment at your location.',
                icon: faTag,
                available: true,
            },
            {
                key: IncentiveRequirementKeys.MAKE_A_PURCHASE,
                label: 'Customer makes a purchase',
                description: 'Reward customers at point of sale. (Coming soon)',
                icon: faCoins,
                available: false,
            },
        ];

        return (
            <>
                <h5 className="mb-3">{this.translate('pages.createEditReward.stepOneTitle')}</h5>
                {options.map((opt) => (
                    <Card
                        key={opt.key}
                        className={`mb-3 cursor-pointer ${!opt.available ? 'opacity-50' : ''} ${inputs.featuredIncentiveKey === opt.key ? 'border-primary' : ''}`}
                        onClick={() => opt.available && this.onInputChange('featuredIncentiveKey', opt.key)}
                        style={{ cursor: opt.available ? 'pointer' : 'not-allowed' }}
                    >
                        <Card.Body className="d-flex align-items-start">
                            <FontAwesomeIcon icon={opt.icon} className="me-3 mt-1 text-primary" />
                            <div className="flex-grow-1">
                                <div className="d-flex align-items-center">
                                    <strong>{opt.label}</strong>
                                    {!opt.available && <Badge bg="secondary" className="ms-2">Coming Soon</Badge>}
                                    {inputs.featuredIncentiveKey === opt.key && opt.available
                                        && <Badge bg="primary" className="ms-2">Selected</Badge>}
                                </div>
                                <small className="text-muted">{opt.description}</small>
                            </div>
                        </Card.Body>
                    </Card>
                ))}
                <div className="d-flex justify-content-end mt-4">
                    <Button variant="primary" onClick={this.onNextStep}>
                        Next: Choose Reward →
                    </Button>
                </div>
            </>
        );
    };

    renderStep2 = () => {
        const { inputs } = this.state;
        const isSubscriber = this.isSubscribed();

        const rewardOptions = [
            {
                key: IncentiveRewardKeys.THERR_COIN_REWARD,
                label: 'TherrCoin Reward',
                description: `Customers earn ${COIN_PER_CHECKIN} TherrCoins (~$${(COIN_PER_CHECKIN * COIN_USD_RATE).toFixed(2)} value) per qualifying action.`,
                icon: faCoins,
                subscriberOnly: false,
            },
            {
                key: IncentiveRewardKeys.PERCENTAGE_DISCOUNT,
                label: 'Percentage Discount',
                description: 'Offer customers a % off their next purchase.',
                icon: faTag,
                subscriberOnly: true,
            },
            {
                key: IncentiveRewardKeys.CURRENCY_DISCOUNT,
                label: 'Fixed Amount Discount',
                description: 'Offer customers a fixed dollar amount off.',
                icon: faGift,
                subscriberOnly: true,
            },
        ];

        return (
            <>
                <h5 className="mb-3">{this.translate('pages.createEditReward.stepTwoTitle')}</h5>
                <Alert variant="info" className="mb-3">
                    <FontAwesomeIcon icon={faCoins} className="me-2" />
                    {this.translate('pages.createEditReward.coinExplainer')}
                </Alert>
                {rewardOptions.map((opt) => {
                    const isLocked = opt.subscriberOnly && !isSubscriber;
                    const isSelected = inputs.featuredIncentiveRewardKey === opt.key;

                    return (
                        <Card
                            key={opt.key}
                            className={`mb-3 ${isLocked ? 'opacity-75' : 'cursor-pointer'} ${isSelected && !isLocked ? 'border-primary' : ''}`}
                            onClick={() => isLocked ? this.onSelectLockedReward() : this.onInputChange('featuredIncentiveRewardKey', opt.key)}
                            style={{ cursor: isLocked ? 'pointer' : 'pointer' }}
                        >
                            <Card.Body className="d-flex align-items-start">
                                <FontAwesomeIcon icon={isLocked ? faLock : opt.icon} className={`me-3 mt-1 ${isLocked ? 'text-muted' : 'text-success'}`} />
                                <div className="flex-grow-1">
                                    <div className="d-flex align-items-center">
                                        <strong>{opt.label}</strong>
                                        {isLocked && (
                                            <Badge bg="warning" text="dark" className="ms-2">
                                                {this.translate('pages.createEditReward.rewardTypeLockedLabel')}
                                            </Badge>
                                        )}
                                        {isSelected && !isLocked && <Badge bg="primary" className="ms-2">Selected</Badge>}
                                    </div>
                                    <small className="text-muted">{opt.description}</small>
                                    {isLocked && (
                                        <div className="mt-1">
                                            <small className="text-warning fw-bold">Upgrade your plan to unlock this reward type.</small>
                                        </div>
                                    )}
                                </div>
                            </Card.Body>
                        </Card>
                    );
                })}
                <div className="d-flex justify-content-between mt-4">
                    <Button variant="outline-secondary" onClick={this.onPrevStep}>
                        ← Back
                    </Button>
                    <Button variant="primary" onClick={this.onNextStep}>
                        Next: Review & Activate →
                    </Button>
                </div>
            </>
        );
    };

    renderStep3 = () => {
        const { fetchedSpace, inputs, isSubmitting } = this.state;

        const requirementLabels: Record<string, string> = {
            [IncentiveRequirementKeys.VISIT_A_SPACE]: 'Customer visits your business',
            [IncentiveRequirementKeys.SHARE_A_MOMENT]: 'Customer shares a photo',
            [IncentiveRequirementKeys.HOST_AN_EVENT]: 'Customer hosts an event',
            [IncentiveRequirementKeys.MAKE_A_PURCHASE]: 'Customer makes a purchase',
        };
        const rewardLabels: Record<string, string> = {
            [IncentiveRewardKeys.THERR_COIN_REWARD]: `${COIN_PER_CHECKIN} TherrCoins (~$${(COIN_PER_CHECKIN * COIN_USD_RATE).toFixed(2)})`,
            [IncentiveRewardKeys.PERCENTAGE_DISCOUNT]: 'Percentage discount',
            [IncentiveRewardKeys.CURRENCY_DISCOUNT]: 'Fixed amount discount',
        };

        return (
            <>
                <h5 className="mb-3">{this.translate('pages.createEditReward.stepThreeTitle')}</h5>
                <Card className="mb-4">
                    <Card.Header className="fw-bold">Reward Summary</Card.Header>
                    <Card.Body>
                        <Row className="mb-2">
                            <Col xs={4} className="text-muted">Space</Col>
                            <Col xs={8} className="fw-bold">{fetchedSpace?.notificationMsg || '—'}</Col>
                        </Row>
                        <Row className="mb-2">
                            <Col xs={4} className="text-muted">Address</Col>
                            <Col xs={8}>{fetchedSpace?.addressReadable || '—'}</Col>
                        </Row>
                        <Row className="mb-2">
                            <Col xs={4} className="text-muted">Trigger</Col>
                            <Col xs={8}>{requirementLabels[inputs.featuredIncentiveKey] || inputs.featuredIncentiveKey}</Col>
                        </Row>
                        <Row className="mb-2">
                            <Col xs={4} className="text-muted">Reward</Col>
                            <Col xs={8} className="text-success fw-bold">{rewardLabels[inputs.featuredIncentiveRewardKey] || inputs.featuredIncentiveRewardKey}</Col>
                        </Row>
                    </Card.Body>
                </Card>

                <Form.Group className="mb-4 d-flex align-items-center">
                    <Form.Check
                        type="switch"
                        id="reward-active-switch"
                        label={inputs.isActive ? 'Reward is Active' : 'Reward is Inactive'}
                        checked={inputs.isActive}
                        onChange={(e) => this.onInputChange('isActive', e.target.checked)}
                        className="fs-5"
                    />
                </Form.Group>

                <Alert variant="light" className="border mb-4">
                    <FontAwesomeIcon icon={faCoins} className="me-2 text-warning" />
                    When active, customers will see a reward badge when they view your space on the Therr app.
                    TherrCoins are transferred from your account to customers upon qualifying actions.
                </Alert>

                <div className="d-flex justify-content-between mt-2">
                    <Button variant="outline-secondary" onClick={this.onPrevStep}>
                        ← Back
                    </Button>
                    <Button
                        variant="primary"
                        onClick={this.onSave}
                        disabled={isSubmitting}
                    >
                        {isSubmitting ? 'Saving…' : this.translate('pages.createEditReward.saveButton')}
                    </Button>
                </div>
            </>
        );
    };

    public render(): JSX.Element | null {
        const {
            alertIsVisible,
            alertVariation,
            alertTitle,
            alertMessage,
            currentStep,
            isLoadingSpace,
            showUpgradeModal,
        } = this.state;
        const { user } = this.props;

        const stepProgress = ((currentStep - 1) / 2) * 100;

        const stepTitles = [
            this.translate('pages.createEditReward.stepOneTitle'),
            this.translate('pages.createEditReward.stepTwoTitle'),
            this.translate('pages.createEditReward.stepThreeTitle'),
        ];

        return (
            <div id="page_create_edit_reward" className="flex-box column">
                <div className="d-flex justify-content-between flex-wrap flex-md-nowrap align-items-center py-4">
                    <ManageRewardsMenu
                        navigateHandler={this.navigateHandler}
                        user={user}
                    />
                    <ButtonGroup>
                        <Button variant="outline-secondary" size="sm" onClick={this.navigateHandler('/rewards')}>
                            ← Back to Rewards
                        </Button>
                    </ButtonGroup>
                </div>

                <Row className="d-flex justify-content-center py-2">
                    <Col xs={12} xl={8}>
                        {isLoadingSpace ? (
                            <p className="text-center mt-5">Loading space details…</p>
                        ) : (
                            <Card border="light" className="bg-white shadow-sm mb-4">
                                <Card.Header>
                                    <h4 className="text-center mb-0">
                                        <FontAwesomeIcon icon={faGift} className="me-2 text-primary" />
                                        {this.translate('pages.createEditReward.pageTitle')}
                                    </h4>
                                </Card.Header>
                                <Card.Body>
                                    <div className="mb-4">
                                        <div className="d-flex justify-content-between mb-1">
                                            {stepTitles.map((title, i) => (
                                                <small
                                                    key={title}
                                                    className={`fw-bold ${currentStep === i + 1 ? 'text-primary' : 'text-muted'}`}
                                                >
                                                    Step {i + 1}: {title}
                                                </small>
                                            ))}
                                        </div>
                                        <ProgressBar now={stepProgress + 50} className="mb-4" style={{ height: '6px' }} />
                                    </div>

                                    {currentStep === 1 && this.renderStep1()}
                                    {currentStep === 2 && this.renderStep2()}
                                    {currentStep === 3 && this.renderStep3()}
                                </Card.Body>
                            </Card>
                        )}
                    </Col>
                </Row>

                {showUpgradeModal && (
                    <div className="modal-overlay" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1050, overflowY: 'auto' }}>
                        <div className="container py-4">
                            <Row className="justify-content-center">
                                <Col xs={12} xl={10}>
                                    <div className="d-flex justify-content-end mb-2">
                                        <Button variant="light" onClick={() => this.setState({ showUpgradeModal: false })}>
                                            ✕ Close
                                        </Button>
                                    </div>
                                    <PricingCards eventSource="create-edit-reward-locked" />
                                </Col>
                            </Row>
                        </div>
                    </div>
                )}

                <ToastContainer className="p-3" position="bottom-end">
                    <Toast bg={alertVariation} show={alertIsVisible && !!alertMessage} onClose={() => this.toggleAlert(false)}>
                        <Toast.Header>
                            <img src="holder.js/20x20?text=%20" className="rounded me-2" alt="" />
                            <strong className="me-auto">{alertTitle}</strong>
                        </Toast.Header>
                        <Toast.Body>{alertMessage}</Toast.Body>
                    </Toast>
                </ToastContainer>
            </div>
        );
    }
}

export default withNavigation(connect(mapStateToProps, mapDispatchToProps)(CreateEditRewardComponent));
