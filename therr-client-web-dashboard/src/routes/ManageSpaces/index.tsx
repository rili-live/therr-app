import React from 'react';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import { NavigateFunction } from 'react-router-dom';
import {
    Col,
    Row,
    Button,
    ButtonGroup,
    Toast,
    ToastContainer,
    ToggleButtonGroup,
} from 'react-bootstrap';
import { MapActions, UserConnectionsActions } from 'therr-react/redux/actions';
import { MapsService, UsersService } from 'therr-react/services';
import {
    IMapState as IMapReduxState,
    IUserState,
    IUserConnectionsState,
    ISearchQuery,
    AccessCheckType,
} from 'therr-react/types';
import { AccessLevels } from 'therr-js-utilities/constants';
import { AxiosResponse } from 'axios';
import { Option } from 'react-bootstrap-typeahead/types/types';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faChevronLeft,
    faChevronRight,
    faMapMarked,
    faMapMarker,
    faMarker,
    faSearch,
} from '@fortawesome/free-solid-svg-icons';
import translator from '../../services/translator';
import withNavigation from '../../wrappers/withNavigation';
import ManageSpacesMenu from '../../components/ManageSpacesMenu';
import SpacesListTable from './SpacesListTable';
import { ISpace } from '../../types';
import { DEFAULT_COORDINATES, DEFAULT_QUERY_LOCALES } from '../../constants/LocationDefaults';
import { getWebsiteName } from '../../utilities/getHostContext';

const ItemsPerPage = 20;

interface IManageSpacesRouterProps {
    navigation: {
        navigate: NavigateFunction;
    }
    routeParams: any;
}

interface IManageSpacesDispatchProps {
    searchUserConnections: Function;
    getPlacesSearchAutoComplete: Function;
    setSearchDropdownVisibility: Function;
}

interface IStoreProps extends IManageSpacesDispatchProps {
    map: IMapReduxState;
    user: IUserState;
    userConnections: IUserConnectionsState;
}

// Regular component props
interface IManageSpacesProps extends IManageSpacesRouterProps, IStoreProps {
    onInitMessaging?: Function;
}

interface IManageSpacesState {
    alertIsVisible: boolean;
    alertVariation: string;
    alertTitle: string;
    alertMessage: string;
    latitude?: number;
    longitude?: number;
    isSubmitting: boolean;
    inputs: {
        [key: string]: any;
    };
    pagination: {
        itemsPerPage: number;
        pageNumber: number;
    };
    spacesInView: ISpace[]; // TODO: Move to Redux
    isLoading: boolean;
}

const mapStateToProps = (state: any) => ({
    map: state.map,
    user: state.user,
    userConnections: state.userConnections,
});

const mapDispatchToProps = (dispatch: any) => bindActionCreators({
    searchUserConnections: UserConnectionsActions.search,
    getPlacesSearchAutoComplete: MapActions.getPlacesSearchAutoComplete,
    setSearchDropdownVisibility: MapActions.setSearchDropdownVisibility,
}, dispatch);

/**
 * ManageSpaces
 */
export class ManageSpacesComponent extends React.Component<IManageSpacesProps, IManageSpacesState> {
    private translate: Function;

    private throttleTimeoutId: any;

    constructor(props: IManageSpacesProps) {
        super(props);

        let pageNumber = 1;
        if (window?.location?.search) {
            const url = new URL(window?.location?.href);
            const urlParams = new URLSearchParams(window?.location?.search);
            pageNumber = parseInt(urlParams.get('page_number'), 10);
            if (Number.isNaN(pageNumber) || pageNumber === 1) {
                url.searchParams.delete('page_number');
                window.history.pushState({}, '', url);
            }
            pageNumber = !Number.isNaN(pageNumber) ? Number(pageNumber) : 1;
        }

        this.state = {
            alertIsVisible: false,
            alertVariation: 'success',
            alertTitle: '',
            alertMessage: '',
            isSubmitting: false,
            inputs: {
                spaceTitle: '',
                spaceDescription: '',
            },
            pagination: {
                itemsPerPage: ItemsPerPage,
                pageNumber,
            },
            spacesInView: [],
            isLoading: false,
        };

        this.translate = (key: string, params: any) => translator('en-us', key, params);
    }

    componentDidMount() {
        const { pagination } = this.state;
        const { routeParams } = this.props;
        document.title = `${getWebsiteName()} | ${this.translate('pages.manageSpaces.pageTitle')}`;

        this.fetchSpaces(pagination.pageNumber, pagination.itemsPerPage);
    }

    componentWillUnmount = () => {
        clearTimeout(this.throttleTimeoutId);
    };

    fetchSpaces = (pageNumber = 1, itemsPerPage = ItemsPerPage) => {
        const { latitude, longitude } = this.state;
        const { routeParams } = this.props;

        this.setState({
            isLoading: true,
        });

        this.setState({
            pagination: {
                ...this.state.pagination,
                pageNumber,
                itemsPerPage,
            },
        }, () => {
            const urlParams = new URLSearchParams(window?.location?.search);
            const queryLocation = urlParams.get('location');
            let searchLatitude = latitude || DEFAULT_COORDINATES.latitude;
            let searchLongitude = longitude || DEFAULT_COORDINATES.longitude;
            if (DEFAULT_QUERY_LOCALES[queryLocation]?.latitude && DEFAULT_QUERY_LOCALES[queryLocation]?.longitude) {
                searchLatitude = DEFAULT_QUERY_LOCALES[queryLocation]?.latitude;
                searchLongitude = DEFAULT_QUERY_LOCALES[queryLocation]?.longitude;
            }

            const searchSpacesPromise: Promise<AxiosResponse<any, any>> = routeParams.context === 'admin'
                ? MapsService.searchSpaces({
                    query: 'connections',
                    itemsPerPage,
                    pageNumber,
                    filterBy: 'fromUserIds',
                    latitude: searchLatitude,
                    longitude: searchLongitude,
                }, {
                    distanceOverride: 160934, // ~ 100 miles
                })
                : MapsService.searchMySpaces({
                    itemsPerPage,
                    pageNumber,
                }); // TODO: Make this an admin route
            searchSpacesPromise.then((response) => new Promise((resolve) => {
                this.setState({
                    spacesInView: response?.data?.results || [],
                }, () => resolve(null));
            })).catch((err) => {
                console.log(err);
            }).finally(() => {
                this.setState({
                    isLoading: false,
                });
            });
        });
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
                latitude: map?.latitude || DEFAULT_COORDINATES.latitude,
                longitude: map?.longitude || DEFAULT_COORDINATES.longitude,
                // radius,
                input: text,
            });
        }, 500);
    };

    onAddressTypeAheadSelect = (selected: Option[]) => {
        const result: any = selected[0];
        console.log(result);

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
                address: result.description,
            },
        });
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

    onSubmitSpaceClaim = (event: React.MouseEvent<HTMLInputElement>) => {
        event.preventDefault();
        const { map } = this.props;
        const {
            address, latitude, longitude, spaceTitle, spaceDescription,
        } = this.state.inputs;

        this.setState({
            isSubmitting: true,
        });

        MapsService.requestClaim({
            title: spaceTitle,
            description: spaceDescription,
            address,
            latitude,
            longitude,
        }).then(() => {
            this.setState({
                alertTitle: 'Request Sent',
                alertMessage: 'Success! Please allow 24-72 hours as we review your request.',
                alertVariation: 'success',
            });
            this.toggleAlert(true);
        }).catch((error) => {
            this.onSubmitError('Unknown Error', 'Failed to process your request. Please try again.');
        }).finally(() => {
            this.setState({
                isSubmitting: false,
            });
        });
    };

    onPageBack = () => {
        const { pagination } = this.state;
        const prevPageNumber = pagination.pageNumber - 1;
        if (window?.location?.search) {
            const url = new URL(window?.location?.href);
            if (prevPageNumber === 1) {
                url.searchParams.delete('page_number');
            } else {
                url.searchParams.set('page_number', prevPageNumber.toString());
            }
            window.history.pushState({}, '', url);
        }
        this.fetchSpaces(prevPageNumber, pagination.itemsPerPage);
    };

    onPageForward = () => {
        const { pagination } = this.state;
        const nextPageNumber = pagination.pageNumber + 1;
        if (window?.location?.search) {
            const url = new URL(window?.location?.href);
            if (nextPageNumber === 1) {
                url.searchParams.delete('page_number');
            } else {
                url.searchParams.set('page_number', nextPageNumber.toString());
            }
            window.history.pushState({}, '', url);
        }
        this.fetchSpaces(nextPageNumber, pagination.itemsPerPage);
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
            pagination,
            spacesInView,
            isLoading,
        } = this.state;
        const { map, routeParams, user } = this.props;
        const urlParams = new URLSearchParams(window?.location?.search);
        const queryLocation = urlParams.get('location');

        return (
            <div id="page_settings" className="flex-box column">
                <div className="d-flex justify-content-between flex-wrap flex-md-nowrap align-items-center py-4">
                    <ManageSpacesMenu
                        navigateHandler={this.navigateHandler}
                        user={user}
                    />

                    <ButtonGroup className="mb-2 mb-md-0">
                        {
                            pagination.pageNumber > 1
                                && <Button onClick={this.onPageBack} variant="outline-primary" size="sm">
                                    <FontAwesomeIcon icon={faChevronLeft} className="me-2" /> Prev. Page
                                </Button>
                        }
                        {
                            spacesInView.length === ItemsPerPage
                                && <Button onClick={this.onPageForward} variant="outline-primary" size="sm">
                                    Next Page <FontAwesomeIcon icon={faChevronRight} className="me-2" />
                                </Button>
                        }
                    </ButtonGroup>
                </div>

                <div className="text-center">
                    <Button variant="secondary" onClick={this.navigateHandler('/claim-a-space')}>
                        <FontAwesomeIcon icon={faMapMarked} className="me-1" /> Claim a Space
                    </Button>
                </div>
                <Row className="d-flex justify-content-around align-items-center py-4">
                    <Col xs={12} xl={12} xxl={10}>
                        {
                            (spacesInView?.length > 0 || isLoading)
                                && <SpacesListTable
                                    spacesInView={spacesInView}
                                    editContext={routeParams.context}
                                    isLoading={isLoading}
                                    previousQueryStringParams={{
                                        location: queryLocation,
                                        page_number: pagination.pageNumber.toString(),
                                    }}
                                    translate={this.translate}
                                />
                        }
                        {
                            !spacesInView?.length && !isLoading
                                && <>
                                    <h3 className="text-center mt-5">
                                        <FontAwesomeIcon icon={faSearch} className="me-2" />We Found 0 Business Locations Associated with Your Account
                                    </h3>
                                    <p className="text-center mt-1">
                                        Spaces are business locations used for hi-fi (geofence) location marketing.
                                        Claim a space to start promoting your local business today.
                                    </p>
                                    <div className="text-center mt-5">
                                        <Button variant="secondary" onClick={this.navigateHandler('/claim-a-space')}>
                                            <FontAwesomeIcon icon={faMapMarked} className="me-1" /> Claim a Business Location
                                        </Button>
                                    </div>
                                </>
                        }
                    </Col>
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

export default withNavigation(connect(mapStateToProps, mapDispatchToProps)(ManageSpacesComponent));
