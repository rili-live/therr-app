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
import { CampaignActions } from 'therr-react/redux/actions';
import translator from '../../services/translator';
import withNavigation from '../../wrappers/withNavigation';
import PricingCards from '../../components/PricingCards';
import CampaignsListTable from './components/CampaignsListTable';
import { ICampaign } from '../../types';
import ManageCampaignsMenu from '../../components/ManageCampaignsMenu';

interface IBaseCampaignsOverviewRouterProps {
    navigation: {
        navigate: NavigateFunction;
    },
    routeParams: any;
}

interface IBaseCampaignsOverviewDispatchProps {
    searchMyCampaigns: Function;
    searchAllCampaigns: Function;
}

interface IStoreProps extends IBaseCampaignsOverviewDispatchProps {
    user: IUserState;
}

// Regular component props
interface IBaseCampaignsOverviewProps extends IBaseCampaignsOverviewRouterProps, IStoreProps {
    isSuperAdmin: boolean;
    isSubscriber: boolean;
}

interface IBaseCampaignsOverviewState {
    currentCampaignIndex: number;
    isLoadingCampaigns: boolean;
    campaignsInView: ICampaign[]; // TODO: Move to Redux
}

const mapStateToProps = (state: any) => ({
    user: state.user,
});

const mapDispatchToProps = (dispatch: any) => bindActionCreators({
    searchMyCampaigns: CampaignActions.searchMyCampaigns,
    searchAllCampaigns: CampaignActions.searchAllCampaigns,
}, dispatch);

/**
 * BaseCampaignsOverview
 */
export class BaseCampaignsOverviewComponent extends React.Component<IBaseCampaignsOverviewProps, IBaseCampaignsOverviewState> {
    private translate: Function;

    constructor(props: IBaseCampaignsOverviewProps) {
        super(props);

        this.state = {
            currentCampaignIndex: 0,
            isLoadingCampaigns: false,
            campaignsInView: [],
        };

        this.translate = (key: string, params: any) => translator('en-us', key, params);
    }

    componentDidMount(): void {
        this.fetchCampaigns();
    }

    navigateHandler = (routeName: string) => () => this.props.navigation.navigate(routeName);

    fetchCampaigns = () => {
        const { searchMyCampaigns, searchAllCampaigns, isSuperAdmin } = this.props;
        this.setState({
            isLoadingCampaigns: true,
        });

        const searchMethod = isSuperAdmin ? searchAllCampaigns : searchMyCampaigns;

        searchMethod({
            itemsPerPage: 50,
            pageNumber: 1,
            order: 'desc',
        }).then((data) => {
            this.setState({
                campaignsInView: data.results,
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
        } = this.state;
        if (currentCampaignIndex > 0) {
            this.setState({
                currentCampaignIndex: currentCampaignIndex - 1,
            }, () => {
                this.fetchCampaigns();
            });
        }
    };

    public render(): JSX.Element | null {
        const {
            isSuperAdmin,
            isSubscriber,
            routeParams,
            user,
        } = this.props;
        const {
            campaignsInView,
            currentCampaignIndex,
            isLoadingCampaigns,
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
                        <div className="d-flex justify-content-around justify-content-md-between flex-wrap flex-md-nowrap align-items-center py-4">
                            <ManageCampaignsMenu
                                navigateHandler={this.navigateHandler}
                                user={user}
                            />
                        </div>
                        {
                            (campaignsInView?.length > 0 || isLoadingCampaigns)
                                && <>
                                    <div className="text-center mt-5">
                                        <Button variant="secondary" className="mb-4" onClick={this.navigateHandler('/campaigns/create')}>
                                            <FontAwesomeIcon icon={faBullhorn} className="me-1" /> Create a Campaign
                                        </Button>
                                    </div>
                                    <CampaignsListTable
                                        campaignsInView={campaignsInView}
                                        editContext={routeParams.context}
                                        isLoading={isLoadingCampaigns}
                                    />
                                </>
                        }
                        {
                            (!campaignsInView?.length && !isLoadingCampaigns)
                            && <>
                                <h3 className="text-center mt-5">
                                    <FontAwesomeIcon icon={faSearch} className="me-2" />We Found 0 Campaigns Associated with Your Account
                                </h3>
                                <p className="text-center mt-1">
                                    Ad campaigns are AI optimized marketing initiatives that can be scheduled, updated, and paused at any time.
                                    Create a campaign to start digital marketing of your business today.
                                </p>
                                <div className="text-center mt-5">
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
                                    <PricingCards eventSource="campaigns-overview" />
                                </Col>
                            </Row>
                        </div>
                }
            </div>
        );
    }
}

export default withNavigation(connect(mapStateToProps, mapDispatchToProps)(BaseCampaignsOverviewComponent));
