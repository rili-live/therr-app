import React from 'react';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import { Location, NavigateFunction } from 'react-router-dom';
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
    AccessLevels, OAuthIntegrationProviders, CampaignAssetTypes, CampaignStatuses,
} from 'therr-js-utilities/constants';
import { v4 as uuidv4 } from 'uuid';
import * as facebook from '../api/facebook';
import translator from '../services/translator';
import withNavigation from '../wrappers/withNavigation';
import EditCampaignForm from '../components/forms/EditCampaignForm';
import { getWebsiteName } from '../utilities/getHostContext';
import ManageCampaignsMenu from '../components/ManageCampaignsMenu';
import { ICampaignAsset } from '../types';
import { signAndUploadImage } from '../utilities/media';
import { onFBLoginPress } from '../api/login';

export const CAMPAIGN_DRAFT_KEY = 'therrCampaignDraft';

const isAdsProviderAuthenticated = (user: IUserState, target: string) => {
    // TODO: Refresh token if almost expired
    const combinedTarget = target === OAuthIntegrationProviders.INSTAGRAM
        ? OAuthIntegrationProviders.FACEBOOK
        : target;

    return user?.settings?.integrations
        && user.settings.integrations[combinedTarget]?.access_token
        && user.settings.integrations[combinedTarget]?.user_access_token_expires_at
        && user.settings.integrations[combinedTarget].user_access_token_expires_at > Date.now();
};

const partitionAssets = (campaign) => {
    const headlineAssets = [];
    const longTextAssets = [];
    const mediaAssets = [];

    campaign?.assets?.forEach((asset) => {
        if (asset.type === CampaignAssetTypes.TEXT) {
            if (asset.headline) {
                headlineAssets.push(asset);
            } else if (asset.longText) {
                longTextAssets.push(asset);
            }
        } else if (asset.type === CampaignAssetTypes.MEDIA) {
            mediaAssets.push(asset);
        }
    });

    return {
        headlineAssets,
        longTextAssets,
        mediaAssets,
    };
};

const getInputDefaults = (campaign: any) => {
    const {
        headlineAssets,
        longTextAssets,
        mediaAssets,
    } = partitionAssets(campaign);

    return {
        address: [],
        type: campaign?.type || 'local',
        status: campaign?.status === CampaignStatuses.PENDING ? CampaignStatuses.ACTIVE : (campaign?.status || CampaignStatuses.PAUSED),
        title: campaign?.title || '',
        description: campaign?.description || '',
        scheduleStartAt: campaign?.scheduleStartAt || '',
        scheduleStopAt: campaign?.scheduleStopAt || '',
        headline1: headlineAssets.length > 0 ? headlineAssets[0].headline : '',
        headline2: headlineAssets.length > 1 ? headlineAssets[1].headline : '',
        longText1: longTextAssets.length > 0 ? longTextAssets[0].longText : '',
        longText2: longTextAssets.length > 1 ? longTextAssets[1].longText : '',
        integrationDetails: campaign?.integrationDetails || {},
        integrationTargets: campaign?.integrationTargets || [OAuthIntegrationProviders.THERR],
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
    mediaPendingUpload: string[];
    requestId: string;
    fetchedIntegrationDetails: {
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

        this.state = {
            alertIsVisible: false,
            alertVariation: 'success',
            alertTitle: '',
            alertMessage: '',
            files: [],
            formEditingStage: 1,
            hasFormChanged: false,
            isSubmitting: false,
            inputs: getInputDefaults(props.campaigns.campaigns[campaignId] || {}),
            isEditing: !!campaignId,
            mediaPendingUpload: [],
            requestId: uuidv4().toString(),
            fetchedIntegrationDetails: {},
        };

        this.translate = (key: string, params: any) => translator('en-us', key, params);
    }

    componentDidMount() {
        document.title = `${getWebsiteName()} | ${this.translate('pages.createACampaign.pageTitle')}`;
        const { getCampaign, campaigns } = this.props;
        const { campaignId } = this.props.routeParams;

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
        } else {
            // TODO: Verify access tokens, and fetch required integration details
        }
    }

    componentWillUnmount = () => {
        clearTimeout(this.throttleTimeoutId);
    };

    afterStateIsEstablished = () => {
        const { user } = this.props;
        const { inputs } = this.state;

        inputs.integrationTargets.forEach((target) => {
            const isAuthed = isAdsProviderAuthenticated(user, target);
            if (isAuthed && (target === OAuthIntegrationProviders.FACEBOOK)) {
                facebook.getMyAccounts(user.settings.integrations[OAuthIntegrationProviders.FACEBOOK]?.access_token).then((results) => {
                    const { fetchedIntegrationDetails } = this.state;
                    this.setState({
                        fetchedIntegrationDetails: {
                            ...fetchedIntegrationDetails,
                            [OAuthIntegrationProviders.FACEBOOK]: results,
                        },
                    });
                }).catch((err) => {
                    // TODO: This might mean the access token is expired and needs to re-authenticate
                    // Prompt the user or display a signal on the provider selection form
                    console.log(err);
                });
            }
        });
    };

    navigateHandler = (routeName: string) => () => this.props.navigation.navigate(routeName);

    isSubmitDisabled = () => {
        const { inputs, isSubmitting, formEditingStage } = this.state;
        // TODO: Remove id block after implementing update
        if (formEditingStage === 1) {
            if (isSubmitting
                || !inputs.title
                || !inputs.description
                || !inputs.type
                || !inputs.scheduleStartAt
                || !inputs.scheduleStopAt) {
                return true;
            }
        } else if (formEditingStage === 2) {
            if (isSubmitting
                || !inputs.headline1
                || !inputs.headline2
                || !inputs.longText1) {
                return true;
            }
        }

        return false;
    };

    goBackStage = (event: React.MouseEvent<HTMLButtonElement>) => {
        event.preventDefault();
        const { formEditingStage } = this.state;

        if (formEditingStage === 1) {
            this.navigateHandler('/campaigns/overview')();
        } else {
            this.setState({
                formEditingStage: formEditingStage - 1,
            });
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
                this.setState({
                    inputs: {
                        ...this.state.inputs,
                        latitude: data?.result?.geometry?.location?.lat,
                        longitude: data?.result?.geometry?.location?.lng,
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
        const newInputChanges = {
            [name]: value,
        };

        this.setState({
            hasFormChanged: true,
            inputs: {
                ...this.state.inputs,
                ...newInputChanges,
            },
        });
    };

    onIntegrationDetailsChange = (integrationProvider: string, event: React.ChangeEvent<HTMLInputElement>) => {
        const { inputs, requestId } = this.state;
        const { location, user } = this.props;

        event.preventDefault();
        this.toggleAlert(false);

        const { name, value } = event.currentTarget;
        const modifiedDetails = { ...inputs.integrationDetails };
        if (!modifiedDetails[integrationProvider]) {
            modifiedDetails[integrationProvider] = {};
        }

        modifiedDetails[integrationProvider][name] = value;
        const newInputChanges = {
            integrationDetails: modifiedDetails,
        };

        this.setState({
            hasFormChanged: true,
            inputs: {
                ...this.state.inputs,
                ...newInputChanges,
            },
        });
    };

    onSelectMedia = (files: any[]) => {
        this.setState({
            hasFormChanged: true,
            files,
        });
    };

    onSocialSyncPress = (target: string) => {
        const { inputs, requestId } = this.state;
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
        } = this.props;
        const { campaignId } = routeParams;
        const campaign = campaigns.campaigns[campaignId] || {};
        const {
            files, formEditingStage, hasFormChanged,
        } = this.state;

        const {
            title,
            description,
            type,
            status,
            scheduleStartAt,
            scheduleStopAt,
            address: selectedAddresses,
            latitude,
            longitude,
            headline1,
            headline2,
            integrationDetails,
            integrationTargets,
            longText1,
            longText2,
        } = this.state.inputs;

        this.setState({
            isSubmitting: true,
        });

        if (!hasFormChanged) {
            if (formEditingStage === 1) {
                this.setState({
                    isSubmitting: false,
                    formEditingStage: 2,
                });
            } else {
                this.setState({
                    isSubmitting: false,
                });
                this.navigateHandler('/campaigns/overview')();
            }
        }

        if (moment(scheduleStopAt).isSameOrBefore(moment(scheduleStartAt))) {
            this.onSubmitError('Invalid Start/End Dates', 'Campaign start date must be before campaign end date');
            this.setState({
                isSubmitting: false,
            });
            return;
        }

        // TODO: Upload if new image asset(s) are added
        const saveMethod = campaign?.id
            ? (campaignDetails) => updateCampaign(campaign?.id, campaignDetails)
            : createCampaign;
        const requestBody: any = {
            title,
            description,
            type,
            status,
            scheduleStartAt,
            scheduleStopAt,
            address: selectedAddresses[0]?.description || selectedAddresses[0]?.label,
            latitude,
            longitude,
            integrationDetails,
            integrationTargets,
        };

        if (!campaign?.status) {
            requestBody.status = formEditingStage < 2 ? 'paused' : 'active';
        }

        // TODO: Make this more dynamic when we allow adding and deleting assets
        const assets: ICampaignAsset[] = [];
        const {
            headlineAssets,
            longTextAssets,
            mediaAssets,
        } = partitionAssets(campaign);
        if (headline1) {
            assets.push({
                id: headlineAssets && headlineAssets[0]?.id,
                type: CampaignAssetTypes.TEXT,
                headline: headline1,
            });
        }
        if (headline2) {
            assets.push({
                id: headlineAssets && headlineAssets[1]?.id,
                type: CampaignAssetTypes.TEXT,
                headline: headline2,
            });
        }
        if (longText1) {
            assets.push({
                id: longTextAssets && longTextAssets[0]?.id,
                type: CampaignAssetTypes.TEXT,
                longText: longText1,
            });
        }
        if (longText2) {
            assets.push({
                id: longTextAssets && longTextAssets[1]?.id,
                type: CampaignAssetTypes.TEXT,
                longText: longText2,
            });
        }
        requestBody.assets = assets;

        (files.length > 0 ? signAndUploadImage({ ...requestBody, isPublic: true }, files, 'campaigns/') : Promise.resolve(requestBody))
            .then((modifiedRequest) => {
                const newMediaAssets = (modifiedRequest.media || []).map((media) => ({
                    type: CampaignAssetTypes.MEDIA,
                    media,
                }));
                const reformattedRequest = {
                    ...modifiedRequest,
                    assets: assets.concat(newMediaAssets),
                };

                delete reformattedRequest.media;
                delete reformattedRequest.isPublic;

                return saveMethod(reformattedRequest)
                    .then((response) => {
                        if (formEditingStage === 1) {
                            this.setState({
                                isSubmitting: false,
                                formEditingStage: 2,
                            });
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

    onSubmitError = (errTitle: string, errMsg: string) => {
        this.setState({
            alertTitle: errTitle,
            alertMessage: errMsg,
            alertVariation: 'danger',
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
                type: AccessCheckType.ALL,
                levels: [
                    AccessLevels.DASHBOARD_SUBSCRIBER_BASIC,
                    AccessLevels.DASHBOARD_SUBSCRIBER_PREMIUM,
                    AccessLevels.DASHBOARD_SUBSCRIBER_PRO,
                    AccessLevels.DASHBOARD_SUBSCRIBER_AGENCY],
                isPublic: true,
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
        } = this.state;
        const {
            campaigns, map, user, routeParams,
        } = this.props;
        const { campaignId } = routeParams;
        const campaign = campaigns.campaigns[campaignId];
        const {
            mediaAssets,
        } = partitionAssets(campaign);

        return (
            <div id="page_settings" className="flex-box column">
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
                                headline1: inputs.headline1,
                                headline2: inputs.headline2,
                                longText1: inputs.longText1,
                                longText2: inputs.longText2,
                                integrationTargets: inputs.integrationTargets,
                            }}
                            fetchedIntegrationDetails={fetchedIntegrationDetails}
                            isSubmitDisabled={this.isSubmitDisabled()}
                            isEditing={isEditing}
                            mediaAssets={mediaAssets}
                            onAddressTypeaheadChange={this.onAddressTypeaheadChange}
                            onAddressTypeAheadSelect={this.onAddressTypeAheadSelect}
                            onDateTimeChange={this.onDateTimeChange}
                            onInputChange={this.onInputChange}
                            onIntegrationDetailsChange={this.onIntegrationDetailsChange}
                            onSelectMedia={this.onSelectMedia}
                            onSocialSyncPress={this.onSocialSyncPress}
                            onSubmit={this.onSubmitCampaign}
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
