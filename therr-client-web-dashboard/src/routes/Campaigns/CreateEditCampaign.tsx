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

interface ICreateEditCampaignRouterProps {
    location: Location;
    routeParams: any;
    navigation: {
        navigate: NavigateFunction;
    }
}

interface ICreateEditCampaignDispatchProps {
    createCampaign: Function;
    updateCampaign: Function;
    getCampaign: Function;
    searchUserConnections: Function;
    getPlacesSearchAutoComplete: Function;
    setSearchDropdownVisibility: Function;
}

interface IStoreProps extends ICreateEditCampaignDispatchProps {
    campaigns: ICampaignsState;
    map: IMapReduxState;
    user: IUserState;
    userConnections: IUserConnectionsState;
}

// Regular component props
interface ICreateEditCampaignProps extends ICreateEditCampaignRouterProps, IStoreProps {
    onInitMessaging?: Function;
}

interface ICreateEditCampaignState {
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
    isEditing: boolean;
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
 * CreateEditCampaign
 */
export class CreateEditCampaignComponent extends React.Component<ICreateEditCampaignProps, ICreateEditCampaignState> {
    static getDerivedStateFromProps(nextProps: ICreateEditCampaignProps, nextState: ICreateEditCampaignState) {
        if (!nextProps?.routeParams?.campaignId && nextState.isEditing) {
            const campaign = {};
            return {
                alertIsVisible: false,
                alertVariation: 'success',
                alertTitle: '',
                alertMessage: '',
                files: [],
                formEditingStage: 1,
                hasFormChanged: false,
                isFormBusy: false,
                isSubmitting: false,
                inputs: getInputDefaults(campaign),
                isEditing: false,
                mediaPendingUpload: [],
                requestId: uuidv4().toString(),
            };
        }
        return {};
    }

    private translate: Function;

    private throttleTimeoutId: any;

    constructor(props: ICreateEditCampaignProps) {
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
            isEditing: !!campaignId,
            mediaPendingUpload: [],
            requestId: uuidv4().toString(),
            fetchedIntegrationDetails: {},
            mySpaces: [],
        };

        this.translate = (key: string, params: any) => translator('en-us', key, params);
    }

    componentDidMount() {
        document.title = `${getWebsiteName()} | ${this.translate('pages.createACampaign.pageTitle')}`;
        const {
            getCampaign, campaigns, location, navigation,
        } = this.props;
        const { campaignId } = this.props.routeParams;

        MapsService.searchMySpaces({
            itemsPerPage: 50,
            pageNumber: 1,
        }).then((response) => {
            const { inputs } = this.state;
            const mySpaces = response?.data?.results || [];
            this.setState({
                mySpaces: response?.data?.results || [],
                inputs: {
                    ...this.state.inputs,
                    spaceId: inputs.spaceId || mySpaces[0]?.id || undefined,
                },
            });
        }).catch((err) => {
            console.log(err);
        });

        // First check if campaign state is stored in localStorage from before user OAuth2 redirected.
        // Clear it out after re-populating the form state.
        const stateStr = localStorage.getItem(CAMPAIGN_DRAFT_KEY);
        const fetchedState = stateStr && JSON.parse(stateStr).state;
        localStorage.removeItem(CAMPAIGN_DRAFT_KEY);
        if (fetchedState) {
            this.setState(fetchedState, this.afterStateIsEstablished);
        }

        if (campaignId && !campaigns.campaigns[campaignId]) {
            // TODO: Make sure assets are returned in search results or we store fetched campaigns separately
            getCampaign(campaignId, {
                withMedia: true,
            }).then((response) => {
                this.setState({
                    inputs: getInputDefaults(response),
                }, this.afterStateIsEstablished);
            }).catch(() => {
                //
            });
        } else if (!fetchedState) {
            // TODO: Cache fetched state so this is no longer necessary
            this.afterStateIsEstablished();
        }
    }

    componentWillUnmount = () => {
        clearTimeout(this.throttleTimeoutId);
    };

    afterStateIsEstablished = (isInit = true) => {
        const { user } = this.props;
        const { inputs } = this.state;

        inputs.integrationTargets.forEach((target) => {
            const isAuthed = isAdsProviderAuthenticated(user, target);
            if (isAuthed
                && (target === OAuthIntegrationProviders.FACEBOOK
                    || (target === OAuthIntegrationProviders.INSTAGRAM && !inputs.integrationTargets?.includes(target === OAuthIntegrationProviders.FACEBOOK)))
            ) {
                // TODO: Add error handling and UI alerts for user
                this.setState({
                    isFormBusy: true,
                });
                Promise.all([
                    facebook.getMyAccounts(user.settings.integrations[OAuthIntegrationProviders.FACEBOOK]?.user_access_token),
                    facebook.getMyAdAccounts(user.settings.integrations[OAuthIntegrationProviders.FACEBOOK]?.user_access_token),
                ]).then(([myAccountResults, myAdAccountResults]) => {
                    const { fetchedIntegrationDetails } = this.state;
                    const fbPageId = inputs?.integrationDetails[OAuthIntegrationProviders.FACEBOOK]?.pageId
                        || myAccountResults?.data[0]?.id || undefined;
                    const newInputChanges = {
                        integrationDetails: {
                            [OAuthIntegrationProviders.FACEBOOK]: {
                                pageId: inputs?.integrationDetails[OAuthIntegrationProviders.FACEBOOK]?.pageId
                                    || myAccountResults?.data[0]?.id || undefined,
                                adAccountId: inputs?.integrationDetails[OAuthIntegrationProviders.FACEBOOK]?.adAccountId
                                    || myAdAccountResults?.data[0]?.id || undefined,
                                campaignId: inputs?.integrationDetails[OAuthIntegrationProviders.FACEBOOK]?.campaignId,
                            },
                        },
                    };

                    const hasFormChanged = !inputs?.integrationDetails[OAuthIntegrationProviders.FACEBOOK]?.pageId
                        || !inputs?.integrationDetails[OAuthIntegrationProviders.FACEBOOK]?.adAccountId
                        || !inputs?.integrationDetails[OAuthIntegrationProviders.FACEBOOK]?.campaignId;
                    if (hasFormChanged) {
                        this.setState({
                            hasFormChanged: true,
                        });
                    }

                    const modifiedIntegrationsFetch = {
                        ...fetchedIntegrationDetails,
                        [OAuthIntegrationProviders.FACEBOOK]: {
                            account: myAccountResults,
                            adAccount: myAdAccountResults,
                        },
                    };
                    const modifiedInputs = {
                        ...this.state.inputs,
                        ...newInputChanges,
                    };

                    const fetchedPage = modifiedIntegrationsFetch[OAuthIntegrationProviders.FACEBOOK]?.account?.data
                        ?.find((account) => account.id === fbPageId);
                    const afterState = () => this.handleIGAccountChange(fetchedPage?.access_token, fbPageId, isInit);

                    this.setState({
                        fetchedIntegrationDetails: modifiedIntegrationsFetch,
                        inputs: modifiedInputs,
                    }, afterState);
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
        });
    };

    navigateHandler = (routeName: string, options?: NavigateOptions) => () => this.props.navigation.navigate(routeName, options);

    isSubmitDisabled = () => {
        const {
            inputs, isFormBusy, isSubmitting, formEditingStage,
        } = this.state;
        // TODO: Remove id block after implementing update
        if (formEditingStage === 1) {
            if (isSubmitting
                || isFormBusy
                || !inputs.title
                || !inputs.description
                || !inputs.type
                || !inputs.scheduleStartAt
                || !inputs.scheduleStopAt
                || (inputs.type === CampaignTypes.LOCAL && !inputs.spaceId)) {
                return true;
            }
        } else if (formEditingStage === 2) {
            if (isSubmitting
                || isFormBusy
                || !inputs.adGroup.headline
                || !inputs.adGroup?.assets?.[0].headline
                || !inputs.adGroup?.assets?.[0].linkUrl) {
                return true;
            }
        }

        return false;
    };

    goBackStage = (event: React.MouseEvent<HTMLButtonElement>) => {
        event.preventDefault();
        const { formEditingStage } = this.state;
        const { location } = this.props;

        if (formEditingStage === 1) {
            this.navigateHandler('/campaigns/overview')();
        } else {
            const newStage = formEditingStage - 1;
            this.setState({
                formEditingStage: newStage,
            });
            this.navigateHandler(`${location.pathname}?stage=${newStage}`, {
                replace: true,
            })();
        }
    };

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

    onRemoveTargetLocation = (label: string) => {
        const targetLocations = [...this.state.inputs.targetLocations].filter((location) => location.label !== label);
        this.setState({
            hasFormChanged: true,
            inputs: {
                ...this.state.inputs,
                targetLocations,
            },
        });
    };

    onDateTimeChange = (name: string, value: string | Moment) => {
        this.toggleAlert(false);
        const newInputChanges = {
            [name]: typeof value === 'string' ? value : value.format('MM/DD/YYYY h:mm A'),
        };

        this.setState({
            hasFormChanged: true,
            inputs: {
                ...this.state.inputs,
                ...newInputChanges,
            },
        });
    };

    onInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        this.toggleAlert(false);
        event.preventDefault();
        const { name, value } = event.currentTarget;
        let newInputChanges: any = {};
        if (name === 'adGroupHeadline') {
            newInputChanges = {
                adGroup: {
                    ...this.state.inputs.adGroup,
                    headline: value,
                },
            };
        } else if (name === 'adGroupDescription') {
            newInputChanges = {
                adGroup: {
                    ...this.state.inputs.adGroup,
                    description: value,
                },
            };
        } else {
            newInputChanges = {
                [name]: value,
            };
        }

        this.setState({
            hasFormChanged: true,
            inputs: {
                ...this.state.inputs,
                ...newInputChanges,
            },
        });
    };

    onAssetInputChange = (event, assetIndex: number, name: string, value: number | string) => {
        this.toggleAlert(false);
        event.preventDefault();
        const adGroup = JSON.parse(JSON.stringify(this.state.inputs.adGroup));
        if (!adGroup?.assets[assetIndex]) {
            adGroup.assets[assetIndex] = {
                type: CampaignAssetTypes.COMBINED,
            };
        }
        adGroup.assets[assetIndex] = {
            ...adGroup.assets[assetIndex],
            type: CampaignAssetTypes.COMBINED,
            [name]: value,
        };

        this.setState({
            hasFormChanged: true,
            inputs: {
                ...this.state.inputs,
                adGroup,
            },
        });
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
                    this.onSubmitError('Missing IG Page ID', 'You must link an Instagram account to your Facebook page or remove the IG target', 'warning');
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

    onSocialSyncPress = (target: string) => {
        const { inputs, requestId, fetchedIntegrationDetails } = this.state;
        const { location, user } = this.props;

        const modifiedTargets = [...inputs.integrationTargets];
        const targetWasEnabled = modifiedTargets.indexOf(target) > -1;
        if (targetWasEnabled) {
            modifiedTargets.splice(modifiedTargets.indexOf(target), 1);
        } else {
            modifiedTargets.push(target);
        }
        const newInputChanges = {
            integrationTargets: modifiedTargets,
        };
        this.setState({
            hasFormChanged: true,
            inputs: {
                ...this.state.inputs,
                ...newInputChanges,
            },
        }, () => {
            if (!targetWasEnabled) {
                // Check redux user.settings for integration access_token
                // Verify that user is logged in. If not, store current form state in localStorage and attempt to oauth2.
                const isIntegrationAuthenticated = isAdsProviderAuthenticated(user, target);
                if (!isIntegrationAuthenticated) {
                    // TODO: Handle all providers
                    if (target !== OAuthIntegrationProviders.THERR) {
                        localStorage.setItem(CAMPAIGN_DRAFT_KEY, JSON.stringify({
                            route: location.pathname,
                            state: this.state,
                        }));
                    }

                    if (target === OAuthIntegrationProviders.FACEBOOK || target === OAuthIntegrationProviders.INSTAGRAM) {
                        onFBLoginPress(requestId);
                    }
                } else if (!fetchedIntegrationDetails[OAuthIntegrationProviders.FACEBOOK]?.account?.data?.length
                    || !fetchedIntegrationDetails[OAuthIntegrationProviders.FACEBOOK]?.adAccount?.data?.length) {
                    // This should occur for any integration when enabling but already authenticated
                    this.afterStateIsEstablished(false);
                }
            }
        });
    };

    onSubmitCampaign = (event: React.MouseEvent<HTMLButtonElement>) => {
        event.preventDefault();

        const {
            campaigns,
            createCampaign,
            updateCampaign,
            routeParams,
            user,
        } = this.props;
        const { campaignId } = routeParams;
        const campaign = campaigns.campaigns[campaignId] || {};
        const {
            inputs, files, formEditingStage, hasFormChanged,
        } = this.state;

        const {
            adGroup,
            title,
            description,
            type,
            status,
            scheduleStartAt,
            scheduleStopAt,
            address: selectedAddresses,
            latitude,
            longitude,
            integrationDetails,
            integrationTargets,
            spaceId,
            targetLocations,
        } = inputs;

        this.setState({
            isSubmitting: true,
        });

        if (!hasFormChanged) {
            if (formEditingStage === 1) {
                const { location } = this.props;
                const newStage = formEditingStage + 1;
                this.setState({
                    isSubmitting: false,
                    formEditingStage: 2,
                });
                return this.navigateHandler(`${location.pathname}?stage=${newStage}`, {
                    replace: true,
                })();
            }

            this.setState({
                isSubmitting: false,
            });
            return this.navigateHandler('/campaigns/overview')();
        }

        if (moment(scheduleStopAt).isSameOrBefore(moment(scheduleStartAt))) {
            this.onSubmitError('Invalid Start/End Dates', 'Campaign stop date must be after campaign start date');
            this.setState({
                isSubmitting: false,
            });
            return;
        }

        if (moment(scheduleStopAt).isSameOrBefore(moment())) {
            this.onSubmitError('Invalid Start/End Dates', 'Campaign stop date must be in the future');
            this.setState({
                isSubmitting: false,
            });
            return;
        }

        // TODO: Upload if new image asset(s) are added
        const saveMethod = campaign?.id
            ? (campaignDetails) => updateCampaign(campaign?.id, campaignDetails)
            : createCampaign;
        const {
            adGroup: originalAdGroup,
            mediaAssets,
        } = partitionAdGroups(campaign);
        const requestBody: any = {
            title,
            description,
            type,
            status,
            scheduleStartAt: moment(scheduleStartAt).format('MM/DD/YYYY h:mm A'),
            scheduleStopAt: moment(scheduleStopAt).format('MM/DD/YYYY h:mm A'),
            address: selectedAddresses[0]?.description || selectedAddresses[0]?.label,
            latitude,
            longitude,
            integrationDetails,
            integrationTargets,
            spaceId,
            targetLocations,
            adGroups: [
                {
                    ...originalAdGroup,
                    spaceId,
                    ...adGroup,
                    headline: adGroup.headline || originalAdGroup.headline,
                    description: adGroup.description || originalAdGroup.description,
                    // goal: adGroup.goal || originalAdGroup.goal,
                },
            ],
        };

        if (!campaign?.status) {
            requestBody.status = formEditingStage < 2 ? 'paused' : 'active';
        }

        (files.length > 0 ? signAndUploadImage({ ...requestBody, isPublic: true }, files, 'campaigns/') : Promise.resolve(requestBody))
            .then((modifiedRequest) => {
                const newMediaAssets = (modifiedRequest.media || []).map((media) => ({
                    type: CampaignAssetTypes.MEDIA,
                    media,
                }));
                const reformattedRequest = {
                    ...modifiedRequest,
                    mediaAssets: newMediaAssets,
                };

                delete reformattedRequest.media;
                delete reformattedRequest.isPublic;

                return saveMethod(reformattedRequest)
                    .then((response) => {
                        if (!response.campaigns[0]?.id) {
                            // TODO: Show alert error message
                            return;
                        }
                        const {
                            adGroup: resultAdGroup,
                        } = partitionAdGroups(response.campaigns[0]);
                        this.setState({
                            inputs: {
                                ...this.state.inputs,
                                integrationDetails: response.campaigns[0].integrationDetails,
                                adGroup: resultAdGroup,
                            },
                        });
                        if (formEditingStage === 1) {
                            const { location } = this.props;
                            const newStage = formEditingStage + 1;
                            this.setState({
                                isSubmitting: false,
                                formEditingStage: newStage,
                            });
                            this.navigateHandler(`/campaigns/${response.campaigns[0].id}/edit?stage=${newStage}`, {
                                replace: true,
                            })();
                        } else {
                            localStorage.removeItem(CAMPAIGN_DRAFT_KEY);
                            this.setState({
                                alertTitle: 'Request Sent',
                                alertMessage: 'Success! Please allow 24-72 hours as we review your campaign.',
                                alertVariation: 'success',
                            });
                            this.toggleAlert(true);

                            setTimeout(() => {
                                this.setState({
                                    isSubmitting: false,
                                });
                                this.navigateHandler('/campaigns/overview')();
                            }, 1000);
                        }
                    });
            }).catch((error) => {
                this.onSubmitError('Unknown Error', 'Failed to process your request. Please try again.');
                this.setState({
                    isSubmitting: false,
                });
            });
    };

    onSubmitError = (errTitle: string, errMsg: string, alertVariation = 'danger') => {
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
            isEditing,
            formEditingStage,
            fetchedIntegrationDetails,
            mySpaces,
        } = this.state;
        const {
            campaigns, map, user, routeParams,
        } = this.props;
        const { campaignId } = routeParams;
        const campaign = campaigns.campaigns[campaignId];
        const {
            mediaAssets,
        } = partitionAdGroups(campaign);

        return (
            <div id="page_campaign_edit" className="flex-box column">
                <div className="d-flex justify-content-between flex-wrap flex-md-nowrap align-items-center py-4">
                    <ManageCampaignsMenu
                        navigateHandler={this.navigateHandler}
                        user={user}
                    />

                    {/* <ButtonGroup>
                        <Button variant="outline-primary" size="sm">Share</Button>
                    </ButtonGroup> */}
                </div>

                <Row className="d-flex justify-content-around align-items-center py-4">
                    <Col md={12} xl={10}>
                        <EditCampaignForm
                            addressTypeAheadResults={map?.searchPredictions?.results || []}
                            formStage={formEditingStage}
                            goBack={this.goBackStage}
                            hasFormChanged={hasFormChanged}
                            inputs={{
                                title: inputs.title,
                                description: inputs.description,
                                type: inputs.type,
                                status: inputs.status,
                                scheduleStartAt: inputs.scheduleStartAt,
                                scheduleStopAt: inputs.scheduleStopAt,
                                integrationDetails: inputs.integrationDetails,
                                integrationTargets: inputs.integrationTargets,
                                spaceId: inputs.spaceId,
                                adGroup: inputs.adGroup,
                                targetLocations: inputs.targetLocations,
                            }}
                            navigateHandler={this.navigateHandler}
                            fetchedIntegrationDetails={fetchedIntegrationDetails}
                            isSubmitDisabled={this.isSubmitDisabled()}
                            isEditing={isEditing}
                            mediaAssets={mediaAssets}
                            onAddressTypeaheadChange={this.onAddressTypeaheadChange}
                            onAddressTypeAheadSelect={this.onAddressTypeAheadSelect}
                            onDateTimeChange={this.onDateTimeChange}
                            onRemoveTargetLocation={this.onRemoveTargetLocation}
                            onAssetInputChange={this.onAssetInputChange}
                            onInputChange={this.onInputChange}
                            onIntegrationDetailsChange={this.onIntegrationDetailsChange}
                            onSelectMedia={this.onSelectMedia}
                            onSocialSyncPress={this.onSocialSyncPress}
                            onSubmit={this.onSubmitCampaign}
                            mySpaces={mySpaces}
                            user={user}
                        />
                    </Col>

                    {/* <Col xs={12} xl={4}>
                        <Row>
                            <Col xs={12}>
                                <ProfileCardWidget />
                            </Col>
                            <Col xs={12}>
                                <ChoosePhotoWidget
                                    title="Select profile photo"
                                    photo={Profile3}
                                />
                            </Col>
                        </Row>
                    </Col> */}
                </Row>
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

export default withNavigation(connect(mapStateToProps, mapDispatchToProps)(CreateEditCampaignComponent));
