import React from 'react';
import { connect } from 'react-redux';
import { NavigateFunction } from 'react-router-dom';
import {
    Alert,
    Button,
    Col,
    Row,
    Toast,
    ToastContainer,
} from 'react-bootstrap';
import { MapsService, UsersService } from 'therr-react/services';
import {
    IUserState,
    AccessCheckType,
} from 'therr-react/types';
import { AccessLevels } from 'therr-js-utilities/constants';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCoins, faGift, faSearch } from '@fortawesome/free-solid-svg-icons';
import translator from '../../services/translator';
import withNavigation from '../../wrappers/withNavigation';
import PricingCards from '../../components/PricingCards';
import ManageRewardsMenu from '../../components/ManageRewardsMenu';
import RewardsListTable from './RewardsListTable';
import { ISpace } from '../../types';
import { getWebsiteName } from '../../utilities/getHostContext';

const LOW_COIN_THRESHOLD = 20;

interface IManageRewardsRouterProps {
    navigation: {
        navigate: NavigateFunction;
    };
}

interface IStoreProps {
    user: IUserState;
}

interface IManageRewardsProps extends IManageRewardsRouterProps, IStoreProps {
    onInitMessaging?: Function;
}

interface IManageRewardsState {
    alertIsVisible: boolean;
    alertVariation: string;
    alertTitle: string;
    alertMessage: string;
    spacesInView: ISpace[];
    isLoading: boolean;
}

const mapStateToProps = (state: any) => ({
    user: state.user,
});

export class ManageRewardsComponent extends React.Component<IManageRewardsProps, IManageRewardsState> {
    private translate: Function;

    constructor(props: IManageRewardsProps) {
        super(props);

        this.state = {
            alertIsVisible: false,
            alertVariation: 'success',
            alertTitle: '',
            alertMessage: '',
            spacesInView: [],
            isLoading: false,
        };

        this.translate = (key: string, params?: any) => translator('en-us', key, params);
    }

    componentDidMount() {
        document.title = `${getWebsiteName()} | ${this.translate('pages.manageRewards.pageTitle')}`;
        this.fetchSpaces();
    }

    fetchSpaces = () => {
        this.setState({ isLoading: true });
        MapsService.searchMySpaces({
            itemsPerPage: 50,
            pageNumber: 1,
        }).then((response) => {
            this.setState({
                spacesInView: response?.data?.results || [],
            });
        }).catch((err) => {
            console.log(err);
        }).finally(() => {
            this.setState({ isLoading: false });
        });
    };

    navigateHandler = (routeName: string) => () => this.props.navigation.navigate(routeName);

    toggleAlert = (show?: boolean) => {
        this.setState({
            alertIsVisible: show !== undefined ? show : !this.state.alertIsVisible,
        });
    };

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

    public render(): JSX.Element | null {
        const {
            alertIsVisible,
            alertVariation,
            alertTitle,
            alertMessage,
            spacesInView,
            isLoading,
        } = this.state;
        const { user } = this.props;
        const isSubscriber = this.isSubscribed();
        const coinBalance = parseFloat(user.details?.settingsTherrCoinTotal || '0');
        const isLowBalance = coinBalance < LOW_COIN_THRESHOLD;

        return (
            <div id="page_manage_rewards" className="flex-box column">
                <div className="d-flex justify-content-between flex-wrap flex-md-nowrap align-items-center py-4">
                    <ManageRewardsMenu
                        navigateHandler={this.navigateHandler}
                        user={user}
                    />
                </div>

                {isSubscriber && (
                    <>
                        <Row className="mb-4">
                            <Col xs={12} md={4}>
                                <div className="d-flex align-items-center p-3 bg-light rounded shadow-sm">
                                    <FontAwesomeIcon icon={faCoins} size="2x" className="text-warning me-3" />
                                    <div>
                                        <small className="text-muted d-block">
                                            {this.translate('pages.manageRewards.coinBalanceLabel')}
                                        </small>
                                        <span className="fw-bold fs-5">{coinBalance.toFixed(2)} TherrCoins</span>
                                    </div>
                                </div>
                            </Col>
                        </Row>

                        {isLowBalance && (
                            <Alert variant="warning" className="mb-4">
                                {this.translate('pages.manageRewards.lowBalanceWarning')}
                            </Alert>
                        )}

                        {(spacesInView.length > 0 || isLoading) && (
                            <Row className="d-flex justify-content-around align-items-center py-2">
                                <Col xs={12}>
                                    <RewardsListTable
                                        spacesInView={spacesInView}
                                        isLoading={isLoading}
                                    />
                                </Col>
                            </Row>
                        )}

                        {!spacesInView.length && !isLoading && (
                            <>
                                <h3 className="text-center mt-5">
                                    <FontAwesomeIcon icon={faSearch} className="me-2" />
                                    {this.translate('pages.manageRewards.emptyState')}
                                </h3>
                                <div className="text-center mt-4">
                                    <Button variant="secondary" onClick={this.navigateHandler('/claim-a-space')}>
                                        Claim a Business Location
                                    </Button>
                                </div>
                            </>
                        )}
                    </>
                )}

                {!isSubscriber && (
                    <div className="d-flex align-items-center">
                        <Row className="justify-content-md-center">
                            <Col xs={12} className="mb-3 text-center">
                                <FontAwesomeIcon icon={faGift} size="3x" className="text-primary mb-3" />
                                <h2>{this.translate('pages.manageRewards.upgradeHeader')}</h2>
                                <p className="lead text-muted mb-4">
                                    {this.translate('pages.manageRewards.upgradeSubtitle')}
                                </p>
                            </Col>
                            <Col xs={12} className="mb-4 d-sm-block">
                                <PricingCards eventSource="rewards-overview" />
                            </Col>
                        </Row>
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

export default withNavigation(connect(mapStateToProps)(ManageRewardsComponent));
