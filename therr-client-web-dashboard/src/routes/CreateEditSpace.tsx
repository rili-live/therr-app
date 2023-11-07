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
import { MapActions, UserConnectionsActions } from 'therr-react/redux/actions';
import { MapsService, UsersService } from 'therr-react/services';
import { AccessLevels, Content } from 'therr-js-utilities/constants';
import {
    IContentState, IMapState as IMapReduxState, IUserState, IUserConnectionsState, AccessCheckType,
} from 'therr-react/types';
import { Option } from 'react-bootstrap-typeahead/types/types';
import translator from '../services/translator';
import withNavigation from '../wrappers/withNavigation';
import EditSpaceForm from '../components/forms/EditSpaceForm';
import ManageSpacesMenu from '../components/ManageSpacesMenu';
import { ISpace } from '../types';
import { signAndUploadImage } from '../utilities/media';
import { getWebsiteName } from '../utilities/getHostContext';

const getInputDefaults = (space: any) => ({
    address: space?.addressReadable ? [
        {
            label: space?.addressReadable,
        },
    ] : undefined,
    category: space?.category || 'uncategorized',
    isPublic: space?.isPublic,
    spaceTitle: space?.notificationMsg || '',
    spaceDescription: space?.message || '',
    phoneNumber: space?.phoneNumber || '',
    websiteUrl: space?.websiteUrl || '',
    menuUrl: space?.menuUrl || '',
    orderUrl: space?.orderUrl || '',
    reservationUrl: space?.reservationUrl || '',
});

interface ICreateEditSpaceRouterProps {
    location: {
        state: {
            space?: ISpace;
        };
    };
    routeParams: any;
    navigation: {
        navigate: NavigateFunction;
    }
}

interface ICreateEditSpaceDispatchProps {
    searchUserConnections: Function;
    updateSpace: Function;
    getPlacesSearchAutoComplete: Function;
    getSpaceDetails: Function;
    setSearchDropdownVisibility: Function;
}

interface IStoreProps extends ICreateEditSpaceDispatchProps {
    content: IContentState;
    map: IMapReduxState;
    user: IUserState;
    userConnections: IUserConnectionsState;
}

// Regular component props
interface ICreateEditSpaceProps extends ICreateEditSpaceRouterProps, IStoreProps {
    onInitMessaging?: Function;
}

interface ICreateEditSpaceState {
    alertIsVisible: boolean;
    alertVariation: string;
    alertTitle: string;
    alertMessage: string;
    fetchedSpace: any;
    files: any[];
    isSubmitting: boolean;
    inputs: {
        [key: string]: any;
    };
    isEditing: boolean;
}

const mapStateToProps = (state: any) => ({
    content: state.content,
    map: state.map,
    user: state.user,
    userConnections: state.userConnections,
});

const mapDispatchToProps = (dispatch: any) => bindActionCreators({
    searchUserConnections: UserConnectionsActions.search,
    updateSpace: MapActions.updateSpace,
    getPlacesSearchAutoComplete: MapActions.getPlacesSearchAutoComplete,
    getSpaceDetails: MapActions.getSpaceDetails,
    setSearchDropdownVisibility: MapActions.setSearchDropdownVisibility,
}, dispatch);

/**
 * CreateEditSpace
 */
export class CreateEditSpaceComponent extends React.Component<ICreateEditSpaceProps, ICreateEditSpaceState> {
    private translate: Function;

    private throttleTimeoutId: any;

    constructor(props: ICreateEditSpaceProps) {
        super(props);

        const { space } = props.location?.state || {};
        const { spaceId } = props.routeParams;

        this.state = {
            alertIsVisible: false,
            alertVariation: 'success',
            alertTitle: '',
            alertMessage: '',
            fetchedSpace: space,
            files: [],
            isSubmitting: false,
            inputs: getInputDefaults(space),
            isEditing: !!spaceId,
        };

        this.translate = (key: string, params: any) => translator('en-us', key, params);
    }

    componentDidMount() {
        document.title = `${getWebsiteName()} | ${this.translate('pages.editSpace.pageTitle')}`;
        const { getSpaceDetails, location } = this.props;
        const { space } = location?.state || {};
        const { spaceId } = this.props.routeParams;
        const id = space?.id || spaceId;

        if (id) {
            getSpaceDetails(id, {
                withMedia: true,
            }).then((data) => {
                const mergedSpace = {
                    ...this.state.fetchedSpace,
                    ...data?.space,
                };
                this.setState({
                    fetchedSpace: mergedSpace,
                    inputs: getInputDefaults(mergedSpace),
                });
            }).catch(() => {
                // Happens when space is not yet activated, but that is OK
            });
        }
    }

    componentWillUnmount = () => {
        clearTimeout(this.throttleTimeoutId);
    };

    navigateHandler = (routeName: string) => () => this.props.navigation.navigate(routeName);

    isSubmitDisabled = () => {
        const { inputs, isSubmitting } = this.state;
        if (isSubmitting) {
            return true;
        }
        if (inputs.address) {
            return false;
        }

        return true;
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
                inputs: {
                    ...this.state.inputs,
                    address: selected,
                },
            });
        }
    };

    onInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
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

    onUpdateSpace = (event: React.MouseEvent<HTMLInputElement>) => {
        const { files, fetchedSpace } = this.state;
        const {
            location,
            navigation,
            updateSpace,
            routeParams,
        } = this.props;
        const { space } = location?.state || {};

        event.preventDefault();
        const {
            address: selectedAddresses,
            category,
            latitude,
            longitude,
            spaceTitle,
            spaceDescription,
            phoneNumber,
            websiteUrl,
            menuUrl,
            orderUrl,
            reservationUrl,
        } = this.state.inputs;

        this.setState({
            isSubmitting: true,
        });

        const spaceInView = {
            ...fetchedSpace,
            ...space,
        };

        if (spaceInView?.id) {
            const createUpdateArgs: any = {
                ...spaceInView,
                notificationMsg: spaceTitle,
                message: spaceDescription,
                category,
                addressReadable: (selectedAddresses?.length && selectedAddresses[0]?.label) || spaceInView.addressReadable,
                phoneNumber,
                websiteUrl,
                menuUrl,
                orderUrl,
                reservationUrl,
            };
            if (routeParams.context === 'admin') {
                createUpdateArgs.overrideFromUserId = spaceInView.fromUserId;
            }
            (files.length > 0 ? signAndUploadImage(createUpdateArgs, files, 'content/') : Promise.resolve(createUpdateArgs)).then((modifiedArgs) => {
                updateSpace(spaceInView.id, modifiedArgs).then(() => {
                    this.setState({
                        alertTitle: 'Successfully Updated!',
                        alertMessage: 'This space was updated without issue.',
                        alertVariation: 'success',
                    });
                    this.toggleAlert(true);
                    setTimeout(() => {
                        this.setState({
                            isSubmitting: false,
                        });
                        navigation.navigate(`/spaces/${routeParams.context}`);
                    }, 1500);
                });
            }).catch((error) => {
                console.log(error);
                this.onSubmitError('Unknown Error', 'Failed to process your request. Please try again later.');
                this.setState({
                    isSubmitting: false,
                });
            }).finally(() => {
                this.setState({
                    isSubmitting: false,
                });
            });
        }
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
            fetchedSpace,
            inputs,
            isEditing,
        } = this.state;
        const { content, map, user } = this.props;
        const mediaId = (fetchedSpace?.media && fetchedSpace?.media[0]?.id) || (fetchedSpace?.mediaIds?.length && fetchedSpace?.mediaIds?.split(',')[0]);
        const spaceMediaUrl = content?.media[mediaId];

        return (
            <div id="page_settings" className="flex-box column">
                <div className="d-flex justify-content-between flex-wrap flex-md-nowrap align-items-center py-4">
                    <ManageSpacesMenu
                        navigateHandler={this.navigateHandler}
                        user={user}
                    />

                    <ButtonGroup>
                        <Button variant="outline-primary" size="sm">Share</Button>
                    </ButtonGroup>
                </div>

                <Row className="d-flex justify-content-around align-items-center py-4">
                    <Col xs={12} xl={10} xxl={8}>
                        <EditSpaceForm
                            addressTypeAheadResults={map?.searchPredictions?.results || []}
                            inputs={{
                                address: inputs.address,
                                category: inputs.category,
                                spaceTitle: inputs.spaceTitle,
                                spaceDescription: inputs.spaceDescription,
                                phoneNumber: inputs.phoneNumber,
                                websiteUrl: inputs.websiteUrl,
                                menuUrl: inputs.menuUrl,
                                orderUrl: inputs.orderUrl,
                                reservationUrl: inputs.reservationUrl,
                            }}
                            mediaUrl={spaceMediaUrl}
                            isEditing={isEditing}
                            isSubmitDisabled={this.isSubmitDisabled()}
                            onAddressTypeaheadChange={this.onAddressTypeaheadChange}
                            onAddressTypeAheadSelect={this.onAddressTypeAheadSelect}
                            onInputChange={this.onInputChange}
                            onSelectMedia={this.onSelectMedia}
                            onSubmit={this.onUpdateSpace}
                            submitText='Update Space'
                            shouldShowAdvancedFields
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

export default withNavigation(connect(mapStateToProps, mapDispatchToProps)(CreateEditSpaceComponent));
