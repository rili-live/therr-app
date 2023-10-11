import React from 'react';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import { NavigateFunction } from 'react-router-dom';
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
import { IMapState as IMapReduxState, IUserState, IUserConnectionsState, AccessCheckType } from 'therr-react/types';
import { Option } from 'react-bootstrap-typeahead/types/types';
import { AccessLevels, CampaignAssetTypes } from 'therr-js-utilities/constants';
import translator from '../services/translator';
import withNavigation from '../wrappers/withNavigation';
import EditCampaignForm from '../components/forms/EditCampaignForm';
import { getWebsiteName } from '../utilities/getHostContext';
import ManageCampaignsMenu from '../components/ManageCampaignsMenu';
import { ICampaign, ICampaignAsset } from '../types';
import { signAndUploadImage } from '../utilities/media';

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
        title: campaign?.title || '',
        description: campaign?.description || '',
        scheduleStartAt: campaign?.scheduleStartAt || '',
        scheduleStopAt: campaign?.scheduleStopAt || '',
        headline1: headlineAssets.length > 0 ? headlineAssets[0].headline : '',
        headline2: headlineAssets.length > 1 ? headlineAssets[1].headline : '',
        longText1: longTextAssets.length > 0 ? longTextAssets[0].longText : '',
        longText2: longTextAssets.length > 1 ? longTextAssets[1].longText : '',
    };
};

interface ICreateEditCampaignRouterProps {
    location: {
        state: {
            campaign?: ICampaign;
        };
    };
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
    fetchedCampaign: any;
    files: any[];
    formEditingStage: number;
    hasFormChanged: boolean;
    isSubmitting: boolean;
    inputs: {
        [key: string]: any;
    };
    isEditing: boolean;
    mediaPendingUpload: string[];
}

const mapStateToProps = (state: any) => ({
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
    private translate: Function;

    private throttleTimeoutId: any;

    constructor(props: ICreateEditCampaignProps) {
        super(props);

        const { campaign } = props.location?.state || {};
        const { campaignId } = props.routeParams;

        this.state = {
            alertIsVisible: false,
            alertVariation: 'success',
            alertTitle: '',
            alertMessage: '',
            fetchedCampaign: campaign,
            files: [],
            formEditingStage: 1,
            hasFormChanged: false,
            isSubmitting: false,
            inputs: getInputDefaults(campaign),
            isEditing: !!campaignId,
            mediaPendingUpload: [],
        };

        this.translate = (key: string, params: any) => translator('en-us', key, params);
    }

    componentDidMount() {
        document.title = `${getWebsiteName()} | ${this.translate('pages.createACampaign.pageTitle')}`;
        const { getCampaign, location } = this.props;
        const { campaign } = location?.state || {};
        const { campaignId } = this.props.routeParams;
        const id = campaign?.id || campaignId;

        if (id) {
            getCampaign(id, {
                withMedia: true,
            }).then((data) => {
                const mergedCampaign = {
                    ...this.state.fetchedCampaign,
                    ...data,
                };
                this.setState({
                    fetchedCampaign: mergedCampaign,
                    inputs: getInputDefaults(mergedCampaign),
                });
            }).catch(() => {
                //
            });
        }
    }

    componentWillUnmount = () => {
        clearTimeout(this.throttleTimeoutId);
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

    onSelectMedia = (files: any[]) => {
        this.setState({
            hasFormChanged: true,
            files,
        });
    };

    onSubmitCampaign = (event: React.MouseEvent<HTMLButtonElement>) => {
        event.preventDefault();

        const { location, createCampaign, updateCampaign } = this.props;
        const {
            files, fetchedCampaign, formEditingStage, hasFormChanged,
        } = this.state;

        const {
            title,
            description,
            type,
            scheduleStartAt,
            scheduleStopAt,
            address: selectedAddresses,
            latitude,
            longitude,
            headline1,
            headline2,
            longText1,
            longText2,
        } = this.state.inputs;
        const { campaign } = location?.state || {};

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

        const campaignInView = {
            ...campaign,
            ...fetchedCampaign,
        };

        // TODO: Upload if new image asset(s) are added
        const saveMethod = campaignInView?.id
            ? (campaignDetails) => updateCampaign(campaignInView?.id, campaignDetails)
            : createCampaign;
        const requestBody: any = {
            title,
            description,
            type,
            scheduleStartAt,
            scheduleStopAt,
            status: formEditingStage < 2 && !campaignInView?.id ? 'paused' : 'active',
            address: selectedAddresses[0]?.description || selectedAddresses[0]?.label,
            latitude,
            longitude,
        };

        if (!campaignInView?.status) {
            requestBody.status = formEditingStage < 2 ? 'paused' : 'active';
        }

        // TODO: Make this more dynamic when we allow adding and deleting assets
        const assets: ICampaignAsset[] = [];
        const {
            headlineAssets,
            longTextAssets,
            mediaAssets,
        } = partitionAssets(campaignInView);
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
                                fetchedCampaign: {
                                    ...fetchedCampaign,
                                    ...response?.campaigns[0],
                                },
                            });
                        } else {
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
            fetchedCampaign,
            hasFormChanged,
            inputs,
            isEditing,
            formEditingStage,
        } = this.state;
        const { map, user } = this.props;
        const {
            mediaAssets,
        } = partitionAssets(fetchedCampaign);

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
                        {
                            isEditing
                                ? <h1 className="text-center">Edit Campaign</h1>
                                : <h1 className="text-center">Create a Marketing Campaign</h1>
                        }
                        <EditCampaignForm
                            addressTypeAheadResults={map?.searchPredictions?.results || []}
                            formStage={formEditingStage}
                            goBack={this.goBackStage}
                            hasFormChanged={hasFormChanged}
                            inputs={{
                                title: inputs.title,
                                description: inputs.description,
                                type: inputs.type,
                                scheduleStartAt: inputs.scheduleStartAt,
                                scheduleStopAt: inputs.scheduleStopAt,
                                headline1: inputs.headline1,
                                headline2: inputs.headline2,
                                longText1: inputs.longText1,
                                longText2: inputs.longText2,
                            }}
                            isSubmitDisabled={this.isSubmitDisabled()}
                            mediaAssets={mediaAssets}
                            onAddressTypeaheadChange={this.onAddressTypeaheadChange}
                            onAddressTypeAheadSelect={this.onAddressTypeAheadSelect}
                            onDateTimeChange={this.onDateTimeChange}
                            onInputChange={this.onInputChange}
                            onSelectMedia={this.onSelectMedia}
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
