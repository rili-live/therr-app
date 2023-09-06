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
import { AccessLevels } from 'therr-js-utilities/constants';
import translator from '../services/translator';
import withNavigation from '../wrappers/withNavigation';
import EditCampaignForm from '../components/forms/EditCampaignForm';
import { getWebsiteName } from '../utilities/getHostContext';
import ManageCampaignsMenu from '../components/ManageCampaignsMenu';

interface ICreateACampaignRouterProps {
    navigation: {
        navigate: NavigateFunction;
    }
}

interface ICreateACampaignDispatchProps {
    createCampaign: Function;
    searchUserConnections: Function;
    getPlacesSearchAutoComplete: Function;
    setSearchDropdownVisibility: Function;
}

interface IStoreProps extends ICreateACampaignDispatchProps {
    map: IMapReduxState;
    user: IUserState;
    userConnections: IUserConnectionsState;
}

// Regular component props
interface ICreateACampaignProps extends ICreateACampaignRouterProps, IStoreProps {
    onInitMessaging?: Function;
}

interface ICreateACampaignState {
    alertIsVisible: boolean;
    alertVariation: string;
    alertTitle: string;
    alertMessage: string;
    files: any[];
    isSubmitting: boolean;
    inputs: {
        [key: string]: any;
    };
}

const mapStateToProps = (state: any) => ({
    map: state.map,
    user: state.user,
    userConnections: state.userConnections,
});

const mapDispatchToProps = (dispatch: any) => bindActionCreators({
    createCampaign: CampaignActions.create,
    searchUserConnections: UserConnectionsActions.search,
    getPlacesSearchAutoComplete: MapActions.getPlacesSearchAutoComplete,
    setSearchDropdownVisibility: MapActions.setSearchDropdownVisibility,
}, dispatch);

/**
 * CreateACampaign
 */
export class CreateACampaignComponent extends React.Component<ICreateACampaignProps, ICreateACampaignState> {
    private translate: Function;

    private throttleTimeoutId: any;

    constructor(props: ICreateACampaignProps) {
        super(props);

        this.state = {
            alertIsVisible: false,
            alertVariation: 'success',
            alertTitle: '',
            alertMessage: '',
            files: [],
            isSubmitting: false,
            inputs: {
                address: [],
                type: 'local',
                title: '',
                description: '',
                scheduleStartAt: '',
                scheduleEndAt: '',
            },
        };

        this.translate = (key: string, params: any) => translator('en-us', key, params);
    }

    componentDidMount() {
        document.title = `${getWebsiteName()} | ${this.translate('pages.createACampaign.pageTitle')}`;
    }

    componentWillUnmount = () => {
        clearTimeout(this.throttleTimeoutId);
    };

    navigateHandler = (routeName: string) => () => this.props.navigation.navigate(routeName);

    isSubmitDisabled = () => {
        const { inputs, isSubmitting } = this.state;
        if (isSubmitting
            || !inputs.title
            || !inputs.description
            || !inputs.type
            || !inputs.scheduleStartAt
            || !inputs.scheduleEndAt) {
            return true;
        }

        return false;
    };

    onAddressTypeaheadChange = (text: string, event: React.ChangeEvent<HTMLInputElement>) => {
        const { getPlacesSearchAutoComplete, map } = this.props;

        clearTimeout(this.throttleTimeoutId);

        this.throttleTimeoutId = setTimeout(() => {
            getPlacesSearchAutoComplete({
                longitude: map?.longitude || '37.76999',
                latitude: map?.latitude || '-122.44696',
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
            inputs: {
                ...this.state.inputs,
                ...newInputChanges,
            },
        });
    };

    onSelectMedia = (files: any[]) => {
        this.setState({
            files,
        });
    };

    onSubmitCampaign = (event: React.MouseEvent<HTMLInputElement>) => {
        event.preventDefault();
        const { createCampaign } = this.props;
        const {
            title,
            description,
            type,
            scheduleStartAt,
            scheduleEndAt,
            address: selectedAddresses,
            latitude,
            longitude,
        } = this.state.inputs;

        this.setState({
            isSubmitting: true,
        });

        if (moment(scheduleEndAt).isSameOrBefore(moment(scheduleStartAt))) {
            this.onSubmitError('Invalid Start/End Dates', 'Campaign start date must be before campaign end date');
            this.setState({
                isSubmitting: false,
            });
            return;
        }

        createCampaign({
            title,
            description,
            type,
            scheduleStartAt,
            scheduleEndAt,
            address: selectedAddresses[0]?.description || selectedAddresses[0]?.label,
            latitude,
            longitude,
        }).then(() => {
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
                this.navigateHandler('/dashboard')();
            }, 1000);
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
            inputs,
        } = this.state;
        const { map, user } = this.props;

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
                    <Col xs={12} xl={10} xxl={8}>
                        <h1 className="text-center">Create a Marketing Campaign</h1>
                        <EditCampaignForm
                            addressTypeAheadResults={map?.searchPredictions?.results || []}
                            inputs={{
                                title: inputs.title,
                                description: inputs.description,
                                type: inputs.type,
                                scheduleStartAt: inputs.scheduleStartAt,
                                scheduleEndAt: inputs.scheduleEndAt,
                            }}
                            isSubmitDisabled={this.isSubmitDisabled()}
                            onAddressTypeaheadChange={this.onAddressTypeaheadChange}
                            onAddressTypeAheadSelect={this.onAddressTypeAheadSelect}
                            onDateTimeChange={this.onDateTimeChange}
                            onInputChange={this.onInputChange}
                            onSelectMedia={this.onSelectMedia}
                            onSubmit={this.onSubmitCampaign}
                            submitText='Save'
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

export default withNavigation(connect(mapStateToProps, mapDispatchToProps)(CreateACampaignComponent));
