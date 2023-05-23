import React from 'react';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import { NavigateFunction } from 'react-router-dom';
import {
    FontAwesomeIcon,
} from '@fortawesome/react-fontawesome';
import {
    faBoxOpen,
    faCartArrowDown,
    faChartPie,
    faChevronDown,
    faClipboard,
    faCommentDots,
    faFileAlt,
    faPlus,
    faRocket,
    faStore,
    faTasks,
    faUserShield,
} from '@fortawesome/free-solid-svg-icons';
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
import { MapsService } from 'therr-react/services';
import { IMapState as IMapReduxState, IUserState, IUserConnectionsState } from 'therr-react/types';
import { Option } from 'react-bootstrap-typeahead/types/types';
import translator from '../services/translator';
import withNavigation from '../wrappers/withNavigation';
import { ChoosePhotoWidget, ProfileCardWidget } from '../components/Widgets';
import EditSpaceForm from '../components/forms/EditSpaceForm';

const Profile3 = '/assets/img/team/profile-picture-3.jpg';

interface IClaimASpaceRouterProps {
    navigation: {
        navigate: NavigateFunction;
    }
}

interface IClaimASpaceDispatchProps {
    searchUserConnections: Function;
    getPlacesSearchAutoComplete: Function;
    setSearchDropdownVisibility: Function;
}

interface IStoreProps extends IClaimASpaceDispatchProps {
    map: IMapReduxState;
    user: IUserState;
    userConnections: IUserConnectionsState;
}

// Regular component props
interface IClaimASpaceProps extends IClaimASpaceRouterProps, IStoreProps {
    onInitMessaging?: Function;
}

interface IClaimASpaceState {
    alertIsVisible: boolean;
    alertVariation: string;
    alertTitle: string;
    alertMessage: string;
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
    searchUserConnections: UserConnectionsActions.search,
    getPlacesSearchAutoComplete: MapActions.getPlacesSearchAutoComplete,
    setSearchDropdownVisibility: MapActions.setSearchDropdownVisibility,
}, dispatch);

/**
 * ClaimASpace
 */
export class ClaimASpaceComponent extends React.Component<IClaimASpaceProps, IClaimASpaceState> {
    private translate: Function;

    private throttleTimeoutId: any;

    constructor(props: IClaimASpaceProps) {
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
        };

        this.translate = (key: string, params: any) => translator('en-us', key, params);
    }

    componentDidMount() {
        const {
            user,
            userConnections,
        } = this.props;
        document.title = `Therr for Business | ${this.translate('pages.settings.pageTitle')} | ${user.details.userName}`;
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
                longitude: map?.longitude || '37.76999',
                latitude: map?.latitude || '-122.44696',
                // radius,
                input: text,
            });
        }, 500);
    };

    onAddressTypeaheadSelect = (selected: Option[]) => {
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
                    <Dropdown className="btn-toolbar">
                        <Dropdown.Toggle as={Button} variant="primary" size="sm" className="me-2">
                            <FontAwesomeIcon icon={faTasks} className="me-2" />Manage Spaces
                        </Dropdown.Toggle>
                        <Dropdown.Menu className="dashboard-dropdown dropdown-menu-left mt-2">
                            <Dropdown.Item className="fw-bold" onClick={this.navigateHandler('/claim-a-space')}>
                                <FontAwesomeIcon icon={faPlus} className="me-2" /> Claim a Space
                            </Dropdown.Item>
                            {/* <Dropdown.Item className="fw-bold" onClick={this.onClaimSpaceClick}>
                                <FontAwesomeIcon icon={faPencilRuler} className="me-2" /> Edit Spaces
                            </Dropdown.Item> */}
                            <Dropdown.Item className="fw-bold" onClick={this.navigateHandler('/claim-a-space')}>
                                <FontAwesomeIcon icon={faUserShield} className="me-2" /> Manage Access
                            </Dropdown.Item>

                            <Dropdown.Divider />

                            <Dropdown.Item className="fw-bold">
                                <FontAwesomeIcon icon={faRocket} className="text-danger me-2" /> Upgrade to Pro
                            </Dropdown.Item>
                        </Dropdown.Menu>
                    </Dropdown>

                    <ButtonGroup>
                        <Button variant="outline-primary" size="sm">Share</Button>
                    </ButtonGroup>
                </div>

                <Row className="d-flex justify-content-around align-items-center py-4">
                    <Col xs={12} xl={10} xxl={8}>
                        <EditSpaceForm
                            addressTypeAheadResults={map?.searchPredictions?.results || []}
                            inputs={inputs}
                            isSubmitDisabled={this.isSubmitDisabled()}
                            onAddressTypeaheadChange={this.onAddressTypeaheadChange}
                            onAddressTypeaheadSelect={this.onAddressTypeaheadSelect}
                            onInputChange={this.onInputChange}
                            onSubmit={this.onSubmitSpaceClaim}
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

export default withNavigation(connect(mapStateToProps, mapDispatchToProps)(ClaimASpaceComponent));
