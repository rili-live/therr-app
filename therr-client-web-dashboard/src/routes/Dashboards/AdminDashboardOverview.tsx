import React from 'react';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import {
    Button, Card, Col, Row,
} from 'react-bootstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCheck } from '@fortawesome/free-solid-svg-icons';
import { CampaignStatuses } from 'therr-js-utilities/constants';
import { CampaignsService, MapsService } from 'therr-react/services';
import { IUserState, IUserConnectionsState } from 'therr-react/types';
import { UserConnectionsActions } from 'therr-react/redux/actions';
import translator from '../../services/translator';
import BaseDashboard from './BaseDashboard';
import { DEFAULT_COORDINATES } from '../../constants/LocationDefaults';
import { getWebsiteName } from '../../utilities/getHostContext';

interface IAdminDashboardOverviewDispatchProps {
    createUserConnection: Function;
    searchUserConnections: Function;
}

interface IStoreProps extends IAdminDashboardOverviewDispatchProps {
    user: IUserState;
}

// Regular component props
interface IAdminDashboardOverviewProps extends IStoreProps {
    onInitMessaging?: Function;
}

interface IAdminDashboardOverviewState {
    campaignsPendingReview: any[];
    spacesPendingApproval: any[];
}

const mapStateToProps = (state: any) => ({
    user: state.user,
    userConnections: state.userConnections,
});

const mapDispatchToProps = (dispatch: any) => bindActionCreators({
    createUserConnection: UserConnectionsActions.create,
    searchUserConnections: UserConnectionsActions.search,
}, dispatch);

const fetchAllSpaces = (latitude?: number, longitude?: number) => MapsService.searchSpaces({
    query: 'connections',
    itemsPerPage: 50,
    pageNumber: 1,
    filterBy: 'fromUserIds',
    latitude: latitude || DEFAULT_COORDINATES.latitude,
    longitude: longitude || DEFAULT_COORDINATES.longitude,
}, {
    distanceOverride: 160934, // ~ 100 miles
});

/**
 * AdminDashboardOverview
 */
export class AdminDashboardOverviewComponent extends React.Component<IAdminDashboardOverviewProps, IAdminDashboardOverviewState> {
    private translate: Function;

    constructor(props: IAdminDashboardOverviewProps) {
        super(props);

        this.state = {
            campaignsPendingReview: [],
            spacesPendingApproval: [],
        };

        this.translate = (key: string, params: any) => translator('en-us', key, params);
    }

    componentDidMount() {
        const {
            user,
        } = this.props;
        document.title = `${getWebsiteName()} | ${this.translate('pages.adminDashboardOverview.pageTitle')}`;

        MapsService.searchSpaces({
            query: 'true',
            itemsPerPage: 50,
            pageNumber: 1,
            filterBy: 'isClaimPending',
            latitude: DEFAULT_COORDINATES.latitude,
            longitude: DEFAULT_COORDINATES.longitude,
        }, {
            distanceOverride: 20037943, // ~ 12451 miles (whole world)
        }).then((response) => {
            this.setState({
                spacesPendingApproval: response?.data?.results || [],
            });
        }).catch((err) => {
            console.log(err);
        });

        CampaignsService.searchAllCampaigns({
            query: 'pending',
            itemsPerPage: 50,
            pageNumber: 1,
            filterBy: 'status',
            // order: 'desc',
        }).then((response) => {
            this.setState({
                campaignsPendingReview: response?.data?.results,
            });
        }).catch((err) => {
            console.log(err);
        });
    }

    getConnectionDetails = (connection) => {
        const { user } = this.props;

        return connection.users.find((u) => u.id !== user.details.id);
    };

    handleInitMessaging = (e, connection) => {
        const { onInitMessaging } = this.props;
        return onInitMessaging && onInitMessaging(e, this.getConnectionDetails(connection), 'user-profile');
    };

    handleApproveClaim = (e, space) => {
        e.preventDefault();
        const { spacesPendingApproval } = this.state;
        const spaceIndex = spacesPendingApproval.findIndex((s) => s.id === space.id);
        const modifiedSpaces = [...spacesPendingApproval];
        modifiedSpaces.splice(spaceIndex, 1);

        MapsService.approveClaim(space.id)
            .then(() => {
                this.setState({
                    spacesPendingApproval: modifiedSpaces,
                });
            }).catch((err) => {
                console.log(err);
            });
    };

    handleApproveCampaign = (e, campaign) => {
        e.preventDefault();
        const { campaignsPendingReview } = this.state;
        const campaignIndex = campaignsPendingReview.findIndex((c) => c.id === campaign.id);
        const modifiedCampaigns = [...campaignsPendingReview];
        modifiedCampaigns.splice(campaignIndex, 1);

        CampaignsService.updateStatus(campaign.id, {
            creatorId: campaign.creatorId,
            status: CampaignStatuses.ACTIVE,
        })
            .then(() => {
                this.setState({
                    campaignsPendingReview: modifiedCampaigns,
                });
            }).catch((err) => {
                console.log(err);
            });
    };

    // eslint-disable-next-line class-methods-use-this
    public render(): JSX.Element | null {
        const {
            campaignsPendingReview,
            spacesPendingApproval,
        } = this.state;

        return (
            <>
                <BaseDashboard fetchSpaces={fetchAllSpaces} isSuperAdmin={true} />

                <Card className="bg-white shadow-sm mb-3 mb-xl-4 mt-2">
                    <Card.Header className="d-flex flex-row align-items-center flex-0">
                        <h3 className="fw-bold text-center">
                            <span className="fw-bolder">Claimed Spaces (pending approval)</span>
                        </h3>
                    </Card.Header>
                    <Card.Body>
                        {
                            !spacesPendingApproval.length && <h5 className="text-center">No claimed spaces pending approval.</h5>
                        }
                        {
                            spacesPendingApproval.map((space) => (
                                <React.Fragment key={space.id}>
                                    <Row>
                                        <Col className="mb-2" md={12} lg={8} xl={9} xxl={10}>{space.id} - {space.notificationMsg}</Col>
                                        <Col className="text-right" md={12} lg={4} xl={3} xxl={2}>
                                            <Button
                                                onClick={(e) => this.handleApproveClaim(e, space)}
                                                variant="primary"
                                                className="text-white w-100"
                                            >
                                                <FontAwesomeIcon icon={faCheck} className="me-1" />
                                                Approve?
                                            </Button>
                                        </Col>
                                    </Row>
                                    <hr />
                                </React.Fragment>
                            ))
                        }
                    </Card.Body>
                </Card>
                <Card className="bg-white shadow-sm mb-3 mb-xl-4 mt-2">
                    <Card.Header className="d-flex flex-row align-items-center flex-0">
                        <h3 className="fw-bold text-center">
                            <span className="fw-bolder">Campaigns (pending review)</span>
                        </h3>
                    </Card.Header>
                    <Card.Body>
                        {
                            !campaignsPendingReview.length && <h5 className="text-center">No campaigns pending review.</h5>
                        }
                        {
                            campaignsPendingReview.map((campaign) => (
                                <React.Fragment key={campaign.id}>
                                    <Row>
                                        <Col className="mb-2" md={12} lg={8} xl={9} xxl={10}>{campaign.id} - {campaign.title}</Col>
                                        <Col className="text-right" md={12} lg={4} xl={3} xxl={2}>
                                            <Button
                                                onClick={(e) => this.handleApproveCampaign(e, campaign)}
                                                variant="primary"
                                                className="text-white w-100"
                                            >
                                                <FontAwesomeIcon icon={faCheck} className="me-1" />
                                                Approve?
                                            </Button>
                                        </Col>
                                    </Row>
                                    <hr />
                                </React.Fragment>
                            ))
                        }
                    </Card.Body>
                </Card>
            </>
        );
    }
}

export default connect(mapStateToProps, mapDispatchToProps)(AdminDashboardOverviewComponent);
