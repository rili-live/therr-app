import React from 'react';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import { NavigateFunction } from 'react-router-dom';
import { AxiosResponse } from 'axios';
import classNames from 'classnames';
import {
    Alert,
    Button,
    Card,
    Col,
    Row,
} from 'react-bootstrap';
import { ICampaignsState, IUserState } from 'therr-react/types';
import { OAuthIntegrationProviders } from 'therr-js-utilities/constants';
import { faBullhorn, faSearch, faUsers } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { CampaignActions } from 'therr-react/redux/actions';
import translator from '../../services/translator';
import withNavigation from '../../wrappers/withNavigation';
import PricingCards from '../../components/PricingCards';
import { ICampaign } from '../../types';
import OverviewOfCampaignMetrics from '../Dashboards/OverviewModules/OverviewOfCampaignMetrics';

interface IBaseAcquisitionDashboardRouterProps {
    navigation: {
        navigate: NavigateFunction;
    }
}

interface IBaseAcquisitionDashboardDispatchProps {
    getCampaign: Function;
}

interface IStoreProps extends IBaseAcquisitionDashboardDispatchProps {
    campaigns: ICampaignsState;
    user: IUserState;
}

// Regular component props
interface IBaseAcquisitionDashboardProps extends IBaseAcquisitionDashboardRouterProps, IStoreProps {
    fetchCampaigns: () => Promise<AxiosResponse<any, any>>;
    isSuperAdmin: boolean;
    isSubscriber: boolean;
}

interface IBaseAcquisitionDashboardState {
    currentCampaignIndex: number;
    isLoadingCampaigns: boolean;
    performanceSummary: {
        [key: string]: any;
    };
    campaignsInView: ICampaign[]; // This is distinguish between my campaigns and admin viewing campaigns
    spanOfTime: 'week' | 'month';
}

const mapStateToProps = (state: any) => ({
    campaigns: state.campaigns,
    user: state.user,
});

const mapDispatchToProps = (dispatch: any) => bindActionCreators({
    getCampaign: CampaignActions.get,
}, dispatch);

/**
 * BaseAcquisitionDashboard
 */
export class BaseAcquisitionDashboardComponent extends React.Component<IBaseAcquisitionDashboardProps, IBaseAcquisitionDashboardState> {
    private translate: Function;

    constructor(props: IBaseAcquisitionDashboardProps) {
        super(props);

        this.state = {
            currentCampaignIndex: 0,
            isLoadingCampaigns: false,
            performanceSummary: {
                [OAuthIntegrationProviders.THERR]: {},
            },
            campaignsInView: [],
            spanOfTime: 'week',
        };

        this.translate = (key: string, params: any) => translator('en-us', key, params);
    }

    componentDidMount = () => {
        this.fetchCampaignInsights('week');
    };

    navigateHandler = (routeName: string) => () => this.props.navigation.navigate(routeName);

    fetchDashboardCampaigns = (latitude?: number, longitude?: number) => {
        const { fetchCampaigns } = this.props;

        return fetchCampaigns().then((response) => new Promise((resolve) => {
            this.setState({
                campaignsInView: response?.data?.results || [],
            }, () => resolve(null));
        }));
    };

    fetchCampaignInsights = (timeSpan: 'week' | 'month') => {
        this.setState({
            spanOfTime: timeSpan,
        });
        const { campaignsInView } = this.state;
        this.setState({
            isLoadingCampaigns: true,
        });
        const prefetchPromise: Promise<any> = !campaignsInView.length ? this.fetchDashboardCampaigns() : Promise.resolve();

        prefetchPromise.then(() => {
            const { currentCampaignIndex, campaignsInView: updatedCampaignsInView } = this.state;
            const campaign = updatedCampaignsInView[currentCampaignIndex];
            const { campaigns, getCampaign } = this.props;

            if (!campaign) {
                this.setState({ isLoadingCampaigns: false });
                return;
            }

            const campaignPromise = (campaign.id && !campaigns.campaigns[campaign.id])
                ? getCampaign(campaign.id, {
                    withMedia: true,
                })
                : Promise.resolve(campaigns.campaigns[campaign.id]);

            campaignPromise.catch((err) => {
                console.log(err);
            }).finally(() => {
                this.setState({
                    isLoadingCampaigns: false,
                });
            });
        }).catch((err) => {
            console.log(err);
        }).finally(() => {
            this.setState({
                isLoadingCampaigns: false,
            });
        });
    };

    onPrevCampaignClick = () => {
        const {
            currentCampaignIndex,
            spanOfTime,
        } = this.state;
        if (currentCampaignIndex > 0) {
            this.setState({
                currentCampaignIndex: currentCampaignIndex - 1,
            }, () => {
                this.fetchCampaignInsights(spanOfTime);
            });
        }
    };

    onNextCampaignClick = () => {
        const {
            currentCampaignIndex,
            campaignsInView,
            spanOfTime,
        } = this.state;
        if (currentCampaignIndex < campaignsInView.length - 1) {
            this.setState({
                currentCampaignIndex: currentCampaignIndex + 1,
            }, () => {
                this.fetchCampaignInsights(spanOfTime);
            });
        }
    };

    public render(): JSX.Element | null {
        const {
            isSuperAdmin,
            isSubscriber,
            user,
        } = this.props;
        const {
            campaignsInView,
            currentCampaignIndex,
            isLoadingCampaigns,
            performanceSummary,
            spanOfTime,
        } = this.state;
        const containerClassNames = classNames({
            'flex-box': true,
            column: isSubscriber,
            center: !isSubscriber,
            'space-evenly': !isSubscriber,
            row: !isSubscriber,
        });

        return (
            <div id="page_campaigns_overview" className={containerClassNames}>
                {
                    isSubscriber && <>
                        <Row className="mb-4">
                            <Col>
                                <h1 className="mb-2">
                                    <FontAwesomeIcon icon={faUsers} className="me-2" />
                                    Your Customers
                                </h1>
                                <p className="text-muted">
                                    Track how your campaigns are driving customer engagement and new visitors to your business.
                                </p>
                            </Col>
                        </Row>
                        <Row className="mb-4">
                            <Col>
                                <Alert variant="info" className="d-flex align-items-center">
                                    <FontAwesomeIcon icon={faBullhorn} className="me-3" size="lg" />
                                    <div>
                                        <strong>Customer Insight:</strong> Your active campaigns are reaching potential customers
                                        in your area. Check the dashboard for space-level engagement metrics including check-ins,
                                        impressions, and visitor trends.
                                    </div>
                                </Alert>
                            </Col>
                        </Row>
                        {
                            (campaignsInView?.length > 0 || isLoadingCampaigns)
                            && <OverviewOfCampaignMetrics
                                navigateHandler={this.navigateHandler}
                                onPrevCampaignClick={this.onPrevCampaignClick}
                                onNextCampaignClick={this.onNextCampaignClick}
                                currentCampaignIndex={currentCampaignIndex}
                                campaignsInView={campaignsInView}
                                spanOfTime={spanOfTime}
                                fetchCampaignInsights={this.fetchCampaignInsights}
                                isLoading={isLoadingCampaigns}
                                isSuperAdmin={isSuperAdmin}
                                performanceSummary={performanceSummary}
                                user={user}
                            />
                        }
                        {
                            (!campaignsInView?.length && !isLoadingCampaigns)
                            && <>
                                <Row className="mt-3">
                                    <Col md={6} lg={4}>
                                        <Card className="bg-white shadow-sm mb-3">
                                            <Card.Body className="text-center py-4">
                                                <h3 className="mb-1">0</h3>
                                                <p className="text-muted mb-0">Active Campaigns</p>
                                            </Card.Body>
                                        </Card>
                                    </Col>
                                    <Col md={6} lg={4}>
                                        <Card className="bg-white shadow-sm mb-3">
                                            <Card.Body className="text-center py-4">
                                                <h3 className="mb-1">--</h3>
                                                <p className="text-muted mb-0">Campaign Reach</p>
                                            </Card.Body>
                                        </Card>
                                    </Col>
                                    <Col md={6} lg={4}>
                                        <Card className="bg-white shadow-sm mb-3">
                                            <Card.Body className="text-center py-4">
                                                <h3 className="mb-1">--</h3>
                                                <p className="text-muted mb-0">Engagement Rate</p>
                                            </Card.Body>
                                        </Card>
                                    </Col>
                                </Row>
                                <h3 className="text-center mt-4">
                                    <FontAwesomeIcon icon={faSearch} className="me-2" />
                                    No Campaign Metrics Yet
                                </h3>
                                <p className="text-center mt-1">
                                    Create your first campaign to start tracking customer acquisition. Campaigns help you reach
                                    new customers in your area and drive foot traffic to your business.
                                </p>
                                <div className="text-center mt-3 mb-4">
                                    <Button variant="secondary" onClick={this.navigateHandler('/campaigns/create')}>
                                        <FontAwesomeIcon icon={faBullhorn} className="me-1" /> Create a Campaign
                                    </Button>
                                </div>
                            </>
                        }
                    </>
                }
                {
                    !isSubscriber
                        && <div className="d-flex align-items-center">
                            <Row className="justify-content-md-center">
                                <Col xs={12} className="mb-4 d-sm-block">
                                    <PricingCards eventSource="customer-acquisition-dashboard" />
                                </Col>
                            </Row>
                        </div>
                }
            </div>
        );
    }
}

export default withNavigation(connect(mapStateToProps, mapDispatchToProps)(BaseAcquisitionDashboardComponent));
