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
} from 'react-bootstrap';
import moment, { Moment } from 'moment';
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

export const CAMPAIGN_DRAFT_KEY = 'therrCampaignDraft';
const DEFAULT_MAX_BUDGET = 100;

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

const getInputDefaults = (campaign: any) => {
    const {
        adGroup,
    } = partitionAdGroups(campaign);

    const initialIntegrationDetails = JSON.parse(JSON.stringify(campaign?.integrationDetails || {}));
    Object.keys(initialIntegrationDetails).forEach((target) => {
        if (!initialIntegrationDetails[target].maxBudget) {
            initialIntegrationDetails[target].maxBudget = DEFAULT_MAX_BUDGET;
        }
    });

    return {
        address: [],
        type: campaign?.type || CampaignTypes.LOCAL,
        status: campaign?.status === CampaignStatuses.PENDING ? CampaignStatuses.ACTIVE : (campaign?.status || CampaignStatuses.PAUSED),
        title: campaign?.title || '',
        description: campaign?.description || '',
        scheduleStartAt: campaign?.scheduleStartAt || new Date(),
        scheduleStopAt: campaign?.scheduleStopAt || new Date(),
        integrationDetails: initialIntegrationDetails,
        integrationTargets: campaign?.integrationTargets || [OAuthIntegrationProviders.THERR],
        spaceId: campaign?.spaceId || '',
        adGroup,
        targetLocations: campaign?.targetLocations || [],
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
    inputs: {
        [key: string]: any;
    };
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
    performanceSummary: any;
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
            inputs: getInputDefaults(props.campaigns.campaigns[campaignId] || {}),
            isLoadingCampaign: true,
            mediaPendingUpload: [],
            requestId: uuidv4().toString(),
            fetchedIntegrationDetails: {},
            mySpaces: [],
            performanceSummary: {},
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
                        performanceSummary: response?.summary || {},
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

    onAddressTypeaheadChange = (text: string, event: React.ChangeEvent<HTMLInputElement>) => {
        const { getPlacesSearchAutoComplete, map } = this.props;

        clearTimeout(this.throttleTimeoutId);

        this.throttleTimeoutId = setTimeout(() => {
            getPlacesSearchAutoComplete({
                longitude: map?.longitude || '-122.44696',
                latitude: map?.latitude || '37.76999',
                // radius,
                input: text,
            });
        }, 500);

        this.setState({
            inputs: {
                ...this.state.inputs,
                address: [
                    {
                        label: text,
                    },
                ],
            },
        });
    };

    onAddressTypeAheadSelect = (selected: Option[]) => {
        const result: any = selected[0];

        if (result) {
            MapsService.getPlaceDetails({
                placeId: result.place_id,
            }).then(({ data }) => {
                const targetLocation = {
                    label: result?.label,
                    latitude: data?.result?.geometry?.location?.lat,
                    longitude: data?.result?.geometry?.location?.lng,
                };
                const targetLocations = [...this.state.inputs.targetLocations];
                if (targetLocation.label && targetLocation.latitude && targetLocation.longitude) {
                    targetLocations.push(targetLocation);
                }
                this.setState({
                    inputs: {
                        ...this.state.inputs,
                        latitude: data?.result?.geometry?.location?.lat, // TODO: Probably can remove this
                        longitude: data?.result?.geometry?.location?.lng, // TODO: Probably can remove this
                        targetLocations,
                    },
                });
            }).catch((err) => {
                console.log(err);
            });

            this.setState({
                hasFormChanged: true,
                inputs: {
                    ...this.state.inputs,
                    address: selected,
                },
            });
        }
    };

    handleIGAccountChange = (fbPageAccessToken, fbPageId, isInit = false) => {
        const { user } = this.props;
        const { inputs } = this.state;
        const target = OAuthIntegrationProviders.INSTAGRAM;
        const isAuthed = isAdsProviderAuthenticated(user, target);
        if (isAuthed && fbPageAccessToken && fbPageId) {
            // TODO: Add error handling and UI alerts for user
            this.setState({
                isFormBusy: true,
            });
            return facebook.getMyIGAccounts(fbPageAccessToken, fbPageId).then((igAccountResults) => {
                const { fetchedIntegrationDetails } = this.state;
                const igPageId = isInit
                    ? (inputs?.integrationDetails[target]?.pageId || igAccountResults?.data[0]?.id || undefined)
                    : igAccountResults?.data[0]?.id || undefined;
                if (!igPageId) {
                    this.onPageError('Missing IG Page ID', 'You must link an Instagram account to your Facebook page or remove the IG target', 'warning');
                }

                const newInputChanges = {
                    integrationDetails: {
                        ...inputs?.integrationDetails,
                        [target]: {
                            pageId: igPageId,
                        },
                    },
                };

                const hasFormChanged = inputs?.integrationDetails[target]?.pageId !== newInputChanges?.integrationDetails[target]?.pageId
                    || this.state.hasFormChanged;
                if (hasFormChanged) {
                    this.setState({
                        hasFormChanged: true,
                    });
                }

                this.setState({
                    fetchedIntegrationDetails: {
                        ...fetchedIntegrationDetails,
                        [target]: {
                            ...fetchedIntegrationDetails[target],
                            igAccount: igAccountResults,
                        },
                    },
                    inputs: {
                        ...this.state.inputs,
                        ...newInputChanges,
                    },
                });
            }).catch((err) => {
                // TODO: This might mean the access token is expired and needs to re-authenticate
                // Prompt the user or display a signal on the provider selection form
                console.log(err);
            }).finally(() => {
                this.setState({
                    isFormBusy: false,
                });
            });
        }

        return Promise.resolve({});
    };

    onIntegrationDetailsChange = (integrationProvider: string, event: React.ChangeEvent<HTMLInputElement>) => {
        const { inputs, fetchedIntegrationDetails } = this.state;
        let afterStateUpdate = () => null;

        event.preventDefault();
        this.toggleAlert(false);

        const { name, value } = event.currentTarget;
        let formattedPropName = name;
        if (name === 'igPageId' || name === 'fbPageId') {
            formattedPropName = 'pageId';
        }
        const modifiedDetails = { ...inputs.integrationDetails };
        if (!modifiedDetails[integrationProvider]) {
            modifiedDetails[integrationProvider] = {};
        }

        modifiedDetails[integrationProvider][formattedPropName] = value;

        if (name === 'maxBudget') {
            modifiedDetails[integrationProvider][formattedPropName] = Math.round(parseInt(value, 10));
        }
        if (name === 'fbPageId') {
            const fetchedPage = fetchedIntegrationDetails[OAuthIntegrationProviders.FACEBOOK]?.account?.data
                ?.find((account) => account.id === value);
            if (fetchedPage?.access_token) {
                afterStateUpdate = () => this.handleIGAccountChange(fetchedPage?.access_token, value);
            }
        }

        const newInputChanges = {
            integrationDetails: modifiedDetails,
        };

        this.setState({
            hasFormChanged: true,
            inputs: {
                ...this.state.inputs,
                ...newInputChanges,
            },
        }, afterStateUpdate);
    };

    onSelectMedia = (files: any[]) => {
        this.setState({
            hasFormChanged: true,
            files,
        });
    };

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
            hasFormChanged,
            inputs,
            isLoadingCampaign,
            formEditingStage,
            fetchedIntegrationDetails,
            mySpaces,
            performanceSummary,
        } = this.state;
        const {
            campaigns, map, user, routeParams,
        } = this.props;
        const { campaignId } = routeParams;
        const campaign = campaigns.campaigns[campaignId];
        const {
            mediaAssets,
        } = partitionAdGroups(campaign);
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
                        <div className="text-center mt-5">
                            <h1>Campaign Performance Summary</h1>
                            <h3 className="fw-normal">Clicks: <span className="fw-bolder">{performanceSummary.clicks || 'N/A'}</span></h3>
                            <h3 className="fw-normal">Unique Clicks: <span className="fw-bolder">{performanceSummary.unique_clicks || 'N/A'}</span></h3>
                            <h3 className="fw-normal">CPM: <span className="fw-bolder">{performanceSummary.cpm || 'N/A'}</span></h3>
                            <h3 className="fw-normal">Impressions: <span className="fw-bolder">{performanceSummary.impressions || 'N/A'}</span></h3>
                            <h3 className="fw-normal">Reach: <span className="fw-bolder">{performanceSummary.reach || 'N/A'}</span></h3>
                            <h3 className="fw-normal">Spend: <span className="fw-bolder">{performanceSummary.spend || 'N/A'}</span></h3>
                        </div>
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
