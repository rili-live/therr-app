import React from 'react';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import { NavigateFunction } from 'react-router-dom';
import classNames from 'classnames';
import {
    Button,
    Col,
    Row,
} from 'react-bootstrap';
import { IUserState } from 'therr-react/types';
import { faBullhorn, faMapMarked, faSearch } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import translator from '../../services/translator';
import withNavigation from '../../wrappers/withNavigation';
import PricingCards from '../../components/PricingCards';
import OverviewOfCampaignMetrics from '../Dashboards/OverviewModules/OverviewOfCampaignMetrics';

interface IBaseAcquisitionDashboardRouterProps {
    navigation: {
        navigate: NavigateFunction;
    }
}

interface IBaseAcquisitionDashboardDispatchProps {
}

interface IStoreProps extends IBaseAcquisitionDashboardDispatchProps {
    user: IUserState;
}

// Regular component props
interface IBaseAcquisitionDashboardProps extends IBaseAcquisitionDashboardRouterProps, IStoreProps {
    isSuperAdmin: boolean;
    isSubscriber: boolean;
}

interface IBaseAcquisitionDashboardState {
    currentCampaignIndex: number;
    isLoadingCampaigns: boolean;
    campaignsInView: any[]; // TODO: Move to Redux
    // campaignsInView: ICampaign[]; // TODO: Move to Redux
    spanOfTime: 'week' | 'month';
}

const mapStateToProps = (state: any) => ({
    user: state.user,
});

const mapDispatchToProps = (dispatch: any) => bindActionCreators({
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
            campaignsInView: [],
            spanOfTime: 'week',
        };

        this.translate = (key: string, params: any) => translator('en-us', key, params);
    }

    navigateHandler = (routeName: string) => () => this.props.navigation.navigate(routeName);

    fetchCampaignMetrics = (timeSpan: 'week' | 'month') => {
        const { campaignsInView } = this.state;
        console.log(timeSpan, campaignsInView);
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
                this.fetchCampaignMetrics(spanOfTime);
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
                this.fetchCampaignMetrics(spanOfTime);
            });
        }
    };

    public render(): JSX.Element | null {
        const {
            isSuperAdmin,
            isSubscriber,
        } = this.props;
        const {
            campaignsInView,
            currentCampaignIndex,
            isLoadingCampaigns,
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
                                fetchCampaignMetrics={this.fetchCampaignMetrics}
                                isLoading={isLoadingCampaigns}
                                isSuperAdmin={isSuperAdmin}
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
                                    <Button variant="secondary" onClick={this.navigateHandler('/create-a-campaign')}>
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
