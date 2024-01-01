import React from 'react';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import { Location, NavigateFunction, NavigateOptions } from 'react-router-dom';
import {
    Col,
    Row,
    Button,
    Dropdown,
    ButtonGroup,
    Toast,
    ToastContainer,
    Card,
} from 'react-bootstrap';
import moment, { Moment } from 'moment';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faFacebook } from '@fortawesome/free-brands-svg-icons';
import { CampaignActions, MapActions, UserConnectionsActions } from 'therr-react/redux/actions';
import { MapsService, UsersService } from 'therr-react/services';
import {
    IMapState as IMapReduxState, IUserState, IUserConnectionsState, AccessCheckType, ICampaignsState,
} from 'therr-react/types';
import { Option } from 'react-bootstrap-typeahead/types/types';
import {
    AccessLevels, OAuthIntegrationProviders, CampaignAssetTypes, CampaignStatuses, CampaignTypes, CampaignAdGoals,
} from 'therr-js-utilities/constants';
import { v4 as uuidv4 } from 'uuid';
import * as facebook from '../../api/facebook';
import translator from '../../services/translator';
import withNavigation from '../../wrappers/withNavigation';
import EditCampaignForm, { isAdsProviderAuthenticated } from '../../components/forms/EditCampaignForm';
import { getWebsiteName } from '../../utilities/getHostContext';
import ManageCampaignsMenu from '../../components/ManageCampaignsMenu';
import { ICampaignAsset } from '../../types';
import { signAndUploadImage } from '../../utilities/media';
import { onFBLoginPress } from '../../api/login';
import PricingCards from '../../components/PricingCards';
import CampaignInsights from '../../components/charts/CampaignInsights';

const partitionAdGroups = (campaign) => {
    const combinedAssets = [];
    const mediaAssets = [];
    const adGroup = JSON.parse(JSON.stringify((campaign?.adGroups && campaign?.adGroups[0]) || {
        assets: [],
        spaceId: campaign?.spaceId || '',
        headline: 'Ad Group 1',
        description: 'The default ad group for this campaign',
        // goal: adGroup.goal || CampaignAdGoals.CLICKS,
    }));

    if (!adGroup.assets?.length) {
        adGroup.assets = [{
            headline: '',
            linkUrl: '',
            longText: '',
            type: CampaignAssetTypes.COMBINED,
        }];
    }

    adGroup.assets.forEach((asset) => {
        if (asset.type === CampaignAssetTypes.MEDIA) {
            mediaAssets.push(asset);
        } else if (asset.type === CampaignAssetTypes.COMBINED) {
            combinedAssets.push(asset);
        }
    });

    return {
        adGroup,
        combinedAssets,
        mediaAssets,
    };
};

interface ICampaignPerformanceRouterProps {
    location: Location;
    routeParams: any;
    navigation: {
        navigate: NavigateFunction;
    }
}

interface ICampaignPerformanceDispatchProps {
    createCampaign: Function;
    updateCampaign: Function;
    getCampaign: Function;
    searchUserConnections: Function;
    getPlacesSearchAutoComplete: Function;
    setSearchDropdownVisibility: Function;
}

interface IStoreProps extends ICampaignPerformanceDispatchProps {
    campaigns: ICampaignsState;
    map: IMapReduxState;
    user: IUserState;
    userConnections: IUserConnectionsState;
}

// Regular component props
interface ICampaignPerformanceProps extends ICampaignPerformanceRouterProps, IStoreProps {
    onInitMessaging?: Function;
}

interface ICampaignPerformanceState {
    alertIsVisible: boolean;
    alertVariation: string;
    alertTitle: string;
    alertMessage: string;
    files: any[];
    formEditingStage: number;
    hasFormChanged: boolean;
    isSubmitting: boolean;
    isLoadingCampaign: boolean;
    isFormBusy: boolean;
    mediaPendingUpload: string[];
    requestId: string;
    fetchedIntegrationDetails: {
        [key: string]: any;
    };
    mySpaces: {
        id: string;
        notificationMsg: string;
    }[];
    performanceSummary: {
        [key: string]: any;
    };
}

const mapStateToProps = (state: any) => ({
    campaigns: state.campaigns,
    map: state.map,
    user: state.user,
    userConnections: state.userConnections,
});

const mapDispatchToProps = (dispatch: any) => bindActionCreators({
    createCampaign: CampaignActions.create,
    getCampaign: CampaignActions.get,
    searchUserConnections: UserConnectionsActions.search,
    getPlacesSearchAutoComplete: MapActions.getPlacesSearchAutoComplete,
    setSearchDropdownVisibility: MapActions.setSearchDropdownVisibility,
    updateCampaign: CampaignActions.update,
}, dispatch);

/**
 * CampaignPerformance
 */
export class CampaignPerformanceComponent extends React.Component<ICampaignPerformanceProps, ICampaignPerformanceState> {
    private translate: Function;

    private throttleTimeoutId: any;

    constructor(props: ICampaignPerformanceProps) {
        super(props);

        const { campaignId } = props.routeParams;

        const urlParams = new URLSearchParams(props.location?.search);
        let stage: string | number = urlParams.get('stage');
        try {
            stage = parseInt(stage, 10);
            stage = Number.isNaN(stage) ? 1 : stage;
        } catch (e) {
            stage = 1;
        }

        this.state = {
            alertIsVisible: false,
            alertVariation: 'success',
            alertTitle: '',
            alertMessage: '',
            files: [],
            formEditingStage: stage || 1,
            hasFormChanged: false,
            isFormBusy: false,
            isSubmitting: false,
            isLoadingCampaign: true,
            mediaPendingUpload: [],
            requestId: uuidv4().toString(),
            fetchedIntegrationDetails: {},
            mySpaces: [],
            performanceSummary: {
                [OAuthIntegrationProviders.THERR]: {},
            },
        };

        this.translate = (key: string, params: any) => translator('en-us', key, params);
    }

    componentDidMount() {
        document.title = `${getWebsiteName()} | ${this.translate('pages.campaignPerformance.pageTitle')}`;
        const {
            getCampaign, campaigns, location, navigation, user,
        } = this.props;
        const { campaignId } = this.props.routeParams;

        const campaignPromise = (campaignId && !campaigns.campaigns[campaignId])
            ? getCampaign(campaignId, {
                withMedia: true,
            }).then((campaign) => campaign)
            : Promise.resolve(campaigns.campaigns[campaignId]);

        campaignPromise.then((campaign) => {
            if (campaign.integrationDetails?.[OAuthIntegrationProviders.FACEBOOK]?.adAccountId
                && campaign.integrationDetails?.[OAuthIntegrationProviders.FACEBOOK]?.campaignId
                && user.settings.integrations[OAuthIntegrationProviders.FACEBOOK]?.user_access_token) {
                return facebook.getCampaignResults(
                    user.settings.integrations[OAuthIntegrationProviders.FACEBOOK]?.user_access_token,
                    campaign.integrationDetails?.[OAuthIntegrationProviders.FACEBOOK]?.adAccountId,
                    campaign.integrationDetails?.[OAuthIntegrationProviders.FACEBOOK]?.campaignId,
                ).then((response) => {
                    this.setState({
                        isLoadingCampaign: false,
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
    }

    componentWillUnmount = () => {
        clearTimeout(this.throttleTimeoutId);
    };

    navigateHandler = (routeName: string, options?: NavigateOptions) => () => this.props.navigation.navigate(routeName, options);

    onPageError = (errTitle: string, errMsg: string, alertVariation = 'danger') => {
        this.setState({
            alertTitle: errTitle,
            alertMessage: errMsg,
            alertVariation,
        });
        this.toggleAlert(true);
    };

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
                    AccessLevels.DASHBOARD_SUBSCRIBER_AGENCY],
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
            performanceSummary,
        } = this.state;
        const {
            campaigns, map, user, routeParams,
        } = this.props;
        const { campaignId } = routeParams;
        const campaign = campaigns.campaigns[campaignId];
        const isSubscriber = this.isSubscribed();

        return (
            <div id="page_campaign_performance" className="flex-box column">
                {
                    isSubscriber && <>
                        <div className="d-flex justify-content-around justify-content-md-between flex-wrap flex-md-nowrap align-items-center py-4">
                            <ManageCampaignsMenu
                                navigateHandler={this.navigateHandler}
                                user={user}
                            />
                        </div>
                        <CampaignInsights
                            campaign={campaign}
                            performanceSummary={performanceSummary}
                        />
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
                <ToastContainer className="p-3" position={'bottom-end'}>
                    <Toast bg={alertVariation} show={alertIsVisible && !!alertMessage} onClose={() => this.toggleAlert(false)}>
                        <Toast.Header>
                            <img src="holder.js/20x20?text=%20" className="rounded me-2" alt="" />
                            <strong className="me-auto">{alertTitle}</strong>
                            {/* <small>1 mins ago</small> */}
                        </Toast.Header>
                        <Toast.Body>{alertMessage}</Toast.Body>
                    </Toast>
                </ToastContainer>
            </div>
        );
    }
}

export default withNavigation(connect(mapStateToProps, mapDispatchToProps)(CampaignPerformanceComponent));
