import React from 'react';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import { Location, NavigateFunction } from 'react-router-dom';
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
    AccessCheckType,
} from 'therr-react/types';
import { AccessLevels } from 'therr-js-utilities/constants';
import { AxiosResponse } from 'axios';
import { Option } from 'react-bootstrap-typeahead/types/types';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faMapMarked,
    faQuestion,
    faSearch,
} from '@fortawesome/free-solid-svg-icons';
import {
    faFacebook, faInstagram, faTiktok, faTwitter, faYoutube,
} from '@fortawesome/free-brands-svg-icons';
import translator from '../../services/translator';
import withNavigation from '../../wrappers/withNavigation';
// import ManageSpacesMenu from '../../components/ManageSpacesMenu';
import { ISpace } from '../../types';
import { DEFAULT_COORDINATES, DEFAULT_QUERY_LOCALES } from '../../constants/LocationDefaults';
import { getWebsiteName } from '../../utilities/getHostContext';
import UsersActions from '../../redux/actions/UsersActions';
import * as globalConfig from '../../../../global-config';
import PricingCards from '../../components/PricingCards';
import InfluencersListTable from './components/InfluencersListTable';

const ItemsPerPage = 50;

const getSocialIcon = (platform: string) => {
    switch (platform) {
        case 'twitter':
            return faTwitter;
        case 'tiktok':
            return faTiktok;
        case 'facebook':
            return faFacebook;
        case 'instagram':
        case 'facebook-instagram':
            return faInstagram;
        case 'youtube':
            return faYoutube;
        default:
            return faQuestion;
    }
};

interface IInfluencerPairingResultsRouterProps {
    location: Location;
    navigation: {
        navigate: NavigateFunction;
    }
    routeParams: any;
}

interface IInfluencerPairingResultsDispatchProps {
    searchInfluencerPairings: Function;
    searchUserConnections: Function;
    getPlacesSearchAutoComplete: Function;
    setSearchDropdownVisibility: Function;
}

interface IStoreProps extends IInfluencerPairingResultsDispatchProps {
    map: IMapReduxState;
    user: IUserState;
    userConnections: IUserConnectionsState;
}

// Regular component props
interface IInfluencerPairingResultsProps extends IInfluencerPairingResultsRouterProps, IStoreProps {
    onInitMessaging?: Function;
}

interface IInfluencerPairingResultsState {
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
    isLoadingInfluencers: boolean;
}

const mapStateToProps = (state: any) => ({
    map: state.map,
    user: state.user,
    userConnections: state.userConnections,
});

const mapDispatchToProps = (dispatch: any) => bindActionCreators({
    searchInfluencerPairings: UsersActions.searchPairings,
    searchUserConnections: UserConnectionsActions.search,
    getPlacesSearchAutoComplete: MapActions.getPlacesSearchAutoComplete,
    setSearchDropdownVisibility: MapActions.setSearchDropdownVisibility,
}, dispatch);

/**
 * InfluencerPairingResults
 */
export class InfluencerPairingResultsComponent extends React.Component<IInfluencerPairingResultsProps, IInfluencerPairingResultsState> {
    private translate: Function;

    private throttleTimeoutId: any;

    constructor(props: IInfluencerPairingResultsProps) {
        super(props);

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
                pageNumber: 1,
            },
            spacesInView: [],
            isLoading: false,
            isLoadingInfluencers: false,
        };

        this.translate = (key: string, params: any) => translator('en-us', key, params);
    }

    componentDidMount() {
        const { pagination } = this.state;
        const { routeParams, searchInfluencerPairings } = this.props;
        document.title = `${getWebsiteName()} | ${this.translate('pages.influencerPairingResults.pageTitle')}`;

        this.fetchSpaces(pagination.pageNumber, pagination.itemsPerPage);

        // TODO: Display pricing page if not authorized
        const isAuthorized = UsersService.isAuthorized(
            {
                type: AccessCheckType.ANY,
                levels: [
                    AccessLevels.DASHBOARD_SUBSCRIBER_AGENCY,
                    // AccessLevels.DASHBOARD_SUBSCRIBER_BASIC, - pairings not included for this pricing package
                    AccessLevels.DASHBOARD_SUBSCRIBER_PREMIUM,
                    AccessLevels.DASHBOARD_SUBSCRIBER_PRO,
                ],
            },
            this.props.user,
        );
        if (isAuthorized) {
            this.setState({
                isLoadingInfluencers: true,
            });
            searchInfluencerPairings(
                {
                    query: '',
                    limit: ItemsPerPage,
                    offset: 0,
                    withMedia: true,
                },
            )
                .catch((err) => {
                    console.log(err);
                })
                .finally(() => {
                    this.setState({
                        isLoadingInfluencers: false,
                    });
                });
        }
    }

    componentWillUnmount = () => {
        clearTimeout(this.throttleTimeoutId);
    };

    fetchSpaces = (pageNumber = 1, itemsPerPage = ItemsPerPage) => {
        const { latitude, longitude } = this.state;
        const { location, routeParams } = this.props;

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
            const urlParams = new URLSearchParams(location?.search);
            const queryLocation = urlParams.get('location');
            let searchLatitude = latitude || DEFAULT_COORDINATES.latitude;
            let searchLongitude = longitude || DEFAULT_COORDINATES.longitude;
            if (DEFAULT_QUERY_LOCALES[queryLocation]?.latitude && DEFAULT_QUERY_LOCALES[queryLocation]?.longitude) {
                searchLatitude = DEFAULT_QUERY_LOCALES[queryLocation]?.latitude;
                searchLongitude = DEFAULT_QUERY_LOCALES[queryLocation]?.longitude;
            }

            const searchSpacesPromise: Promise<AxiosResponse<any, any>> = MapsService.searchMySpaces({
                itemsPerPage,
                pageNumber,
            });
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
        this.fetchSpaces(pagination.pageNumber - 1, pagination.itemsPerPage);
    };

    onPageForward = () => {
        const { pagination } = this.state;
        this.fetchSpaces(pagination.pageNumber + 1, pagination.itemsPerPage);
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
                type: AccessCheckType.ANY,
                levels: [
                    // AccessLevels.DASHBOARD_SUBSCRIBER_BASIC, // Basic package does not include influencer pairings at this time
                    AccessLevels.DASHBOARD_SUBSCRIBER_PREMIUM,
                    AccessLevels.DASHBOARD_SUBSCRIBER_PRO,
                    AccessLevels.DASHBOARD_SUBSCRIBER_AGENCY],
            },
            user,
        );
    };

    renderInfluencers = (influencerPairings: any[]) => {
        const { isLoadingInfluencers } = this.state;
        if (influencerPairings?.length > 0 || isLoadingInfluencers) {
            return (<Row className="mt-5 justify-content-center">
                <Col md={12} lg={10}>
                    <InfluencersListTable
                        influencerPairings={influencerPairings}
                        isLoading={isLoadingInfluencers}
                    />
                </Col>
            </Row>);
        }

        return (
            <h3 className="text-center mt-5">
                <FontAwesomeIcon icon={faSearch} className="me-2" />
                We Found 0 Influencers Related To Your Business Location(s)
            </h3>
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
            isLoadingInfluencers,
        } = this.state;
        const { map, routeParams, user } = this.props;
        const influencerPairings: any[] = Object.values(user.influencerPairings || {});
        const isSubscriber = this.isSubscribed();

        return (
            <div id="page_settings" className="flex-box column">
                {
                    isSubscriber
                        && <>
                            <div className="d-flex justify-content-between flex-wrap flex-md-nowrap align-items-center py-4">
                                {/* <ManageSpacesMenu
                                    navigateHandler={this.navigateHandler}
                                    user={user}
                                /> */}

                                {/* <ButtonGroup className="mb-2 mb-md-0">
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
                                </ButtonGroup> */}
                            </div>

                            <Row className="d-flex justify-content-around align-items-center py-4">
                                <Col xs={12} xl={12} xxl={10}>
                                    <h1 className="text-center">Local Influencer Pairings</h1>
                                    {
                                        !spacesInView?.length && !isLoading && !isLoadingInfluencers
                                            ? <>
                                                <p className="text-center mt-1">
                                                    Claim a business space to start matching with local influencers today.
                                                </p>
                                                <div className="text-center mt-5">
                                                    <Button variant="secondary" onClick={this.navigateHandler('/claim-a-space')}>
                                                        <FontAwesomeIcon icon={faMapMarked} className="me-1" /> Claim a Business Location
                                                    </Button>
                                                </div>
                                            </>
                                            : this.renderInfluencers(influencerPairings)
                                    }
                                </Col>
                            </Row>
                        </>
                }
                {
                    !isSubscriber
                        && <div className="d-flex align-items-center">
                            <Row className="justify-content-md-center">
                                <Col xs={12} className="mb-4 d-sm-block">
                                    <PricingCards eventSource="influencer-pairings" />
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

export default withNavigation(connect(mapStateToProps, mapDispatchToProps)(InfluencerPairingResultsComponent));
