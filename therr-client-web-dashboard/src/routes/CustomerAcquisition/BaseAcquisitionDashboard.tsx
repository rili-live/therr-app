import React from 'react';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import { NavigateFunction } from 'react-router-dom';
import { AxiosResponse } from 'axios';
import classNames from 'classnames';
import {
    Button,
    Col,
    Row,
} from 'react-bootstrap';
import { ICampaignsState, IUserState } from 'therr-react/types';
import { OAuthIntegrationProviders } from 'therr-js-utilities/constants';
import { faBullhorn, faMapMarked, faSearch } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { CampaignActions } from 'therr-react/redux/actions';
import translator from '../../services/translator';
import withNavigation from '../../wrappers/withNavigation';
import PricingCards from '../../components/PricingCards';
import { ICampaign } from '../../types';
import * as facebook from '../../api/facebook';
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
            const { campaigns, getCampaign, user } = this.props;

            const campaignPromise = (campaign.id && !campaigns.campaigns[campaign.id])
                ? getCampaign(campaign.id, {
                    withMedia: true,
                })
                : Promise.resolve(campaigns.campaigns[campaign.id]);

            campaignPromise.then((fetchedCampaign) => {
                if (fetchedCampaign.integrationDetails?.[OAuthIntegrationProviders.FACEBOOK]?.adAccountId
                    && fetchedCampaign.integrationDetails?.[OAuthIntegrationProviders.FACEBOOK]?.campaignId
                    && user.settings.integrations[OAuthIntegrationProviders.FACEBOOK]?.user_access_token) {
                    return facebook.getCampaignResults(
                        user.settings.integrations[OAuthIntegrationProviders.FACEBOOK]?.user_access_token,
                        fetchedCampaign.integrationDetails?.[OAuthIntegrationProviders.FACEBOOK]?.adAccountId,
                        fetchedCampaign.integrationDetails?.[OAuthIntegrationProviders.FACEBOOK]?.campaignId,
                    ).then((response) => {
                        this.setState({
                            isLoadingCampaigns: false,
                            performanceSummary: {
                                ...this.state.performanceSummary,
                                [OAuthIntegrationProviders.FACEBOOK]: response?.summary || {},
                            },
                        });
                    });
                }
            }).catch((err) => {
                console.log(err);
            });

            console.log('campaign selected', updatedCampaignsInView[currentCampaignIndex]);
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
                                <h3 className="text-center mt-5">
                                    <FontAwesomeIcon icon={faSearch} className="me-2" />We Found 0 Campaign Metrics Associated with Your Account
                                </h3>
                                <p className="text-center mt-1">
                                    Ad campaigns are AI optimized marketing initiatives that can be scheduled, updated, and paused at any time.
                                    Create a campaign to start digital marketing of your business today.
                                </p>
                                {/* <div className="text-center mt-5">
                                    <Button variant="secondary" onClick={this.navigateHandler('/campaigns/edit')}>
                                        <FontAwesomeIcon icon={faBullhorn} className="me-1" /> Create a Campaign
                                    </Button>
                                </div> */}
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
