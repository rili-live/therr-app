import React from 'react';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import { NavigateFunction } from 'react-router-dom';
import moment from 'moment-timezone';
import {
    FontAwesomeIcon,
} from '@fortawesome/react-fontawesome';
import {
    faCashRegister,
    faChartLine,
    faCloudUploadAlt,
    faPlus,
    faRocket,
    faTasks,
    faUserShield,
} from '@fortawesome/free-solid-svg-icons';
import {
    Col,
    Row,
    Button,
    Dropdown,
    ButtonGroup,
} from '@themesberg/react-bootstrap';
import { UserConnectionsActions } from 'therr-react/redux/actions';
import { MapsService } from 'therr-react/services';
import { IUserState, IUserConnectionsState } from 'therr-react/types';
import translator from '../services/translator';
import withNavigation from '../wrappers/withNavigation';
import {
    CounterWidget,
    CircleChartWidget,
    BarChartWidget,
    TeamMembersWidget,
    ProgressTrackWidget,
    RankingWidget,
    SalesValueWidget,
    SalesValueWidgetPhone,
    AcquisitionWidget,
} from '../components/Widgets';
import {
    PageVisitsTable,
} from '../components/Tables';
import {
    trafficShares,
    totalOrders,
} from '../data/charts';

interface IDashboardOverviewRouterProps {
    navigation: {
        navigate: NavigateFunction;
    }
}

interface IDashboardOverviewDispatchProps {
    createUserConnection: Function;
    searchUserConnections: Function;
}

interface IStoreProps extends IDashboardOverviewDispatchProps {
    user: IUserState;
    userConnections: IUserConnectionsState;
}

// Regular component props
interface IDashboardOverviewProps extends IDashboardOverviewRouterProps, IStoreProps {
    onInitMessaging?: Function;
}

interface IDashboardOverviewState {
    metrics: any[];
}

const mapStateToProps = (state: any) => ({
    user: state.user,
    userConnections: state.userConnections,
});

const mapDispatchToProps = (dispatch: any) => bindActionCreators({
    createUserConnection: UserConnectionsActions.create,
    searchUserConnections: UserConnectionsActions.search,
}, dispatch);

/**
 * DashboardOverview
 */
export class DashboardOverviewComponent extends React.Component<IDashboardOverviewProps, IDashboardOverviewState> {
    private translate: Function;

    constructor(props: IDashboardOverviewProps) {
        super(props);

        this.state = {
            metrics: [],
        };

        this.translate = (key: string, params: any) => translator('en-us', key, params);
    }

    componentDidMount() {
        const {
            user,
            userConnections,
        } = this.props;
        document.title = `Therr for Business | ${this.translate('pages.dashboardOverview.pageTitle')} | ${user.details.userName}`;
        if (!userConnections.connections.length) {
            this.props.searchUserConnections({
                filterBy: 'acceptingUserId',
                query: user.details.id,
                itemsPerPage: 50,
                pageNumber: 1,
                orderBy: 'interactionCount',
                order: 'desc',
                shouldCheckReverse: true,
            }, user.details.id);
        }
        if (!this.state.metrics.length) {
            this.fetchSpaceMetrics('week');
        }
    }

    fetchSpaceMetrics = (timeSpan: 'week' | 'month') => {
        const startDate = moment().subtract(1, `${timeSpan}s`).utc().format('YYYY-MM-DD HH:mm:ss');
        const endDate = moment().utc().format('YYYY-MM-DD HH:mm:ss');
        // TODO: get current user spaces
        MapsService.getSpaceMetrics('04065742-f260-4cfe-b70b-69c3983bec83', {
            startDate,
            endDate,
        }).then((response) => {
            this.setState({
                metrics: response.data.metrics,
            });
        }).catch((err) => {
            console.log(err);
        });
    };

    getConnectionDetails = (connection) => {
        const { user } = this.props;

        return connection.users.find((u) => u.id !== user.details.id);
    };

    handleInitMessaging = (e, connection) => {
        const { onInitMessaging } = this.props;
        return onInitMessaging && onInitMessaging(e, this.getConnectionDetails(connection), 'user-profile');
    };

    onCreateForumClick = () => {
        this.props.navigation.navigate('/create-forum');
    };

    public render(): JSX.Element | null {
        return (
            <div id="page_user_profile" className="flex-box column">
                <div className="d-flex justify-content-between flex-wrap flex-md-nowrap align-items-center py-4">
                    <Dropdown className="btn-toolbar">
                        <Dropdown.Toggle as={Button} variant="primary" size="sm" className="me-2">
                            <FontAwesomeIcon icon={faPlus} className="me-2" />New Task
                        </Dropdown.Toggle>
                        <Dropdown.Menu className="dashboard-dropdown dropdown-menu-left mt-2">
                            <Dropdown.Item className="fw-bold">
                                <FontAwesomeIcon icon={faTasks} className="me-2" /> New Task
                            </Dropdown.Item>
                            <Dropdown.Item className="fw-bold">
                                <FontAwesomeIcon icon={faCloudUploadAlt} className="me-2" /> Upload Files
                            </Dropdown.Item>
                            <Dropdown.Item className="fw-bold">
                                <FontAwesomeIcon icon={faUserShield} className="me-2" /> Preview Security
                            </Dropdown.Item>

                            <Dropdown.Divider />

                            <Dropdown.Item className="fw-bold">
                                <FontAwesomeIcon icon={faRocket} className="text-danger me-2" /> Upgrade to Pro
                            </Dropdown.Item>
                        </Dropdown.Menu>
                    </Dropdown>

                    <ButtonGroup>
                        <Button variant="outline-primary" size="sm">Share</Button>
                        <Button variant="outline-primary" size="sm">Export</Button>
                    </ButtonGroup>
                </div>

                <Row className="justify-content-md-center">
                    <Col xs={12} className="mb-4 d-none d-sm-block">
                        <SalesValueWidget
                            title="Sales Value"
                            value="10,567"
                            percentage={10.57}
                            fetchSpaceMetrics={this.fetchSpaceMetrics}
                        />
                    </Col>
                    <Col xs={12} className="mb-4 d-sm-none">
                        <SalesValueWidgetPhone
                            title="Sales Value"
                            value="10,567"
                            percentage={10.57}
                        />
                    </Col>
                    <Col xs={12} sm={6} xl={4} className="mb-4">
                        <CounterWidget
                            category="Customers"
                            title="345k"
                            period="Feb 1 - Apr 1"
                            percentage={18.2}
                            icon={faChartLine}
                            iconColor="shape-secondary"
                        />
                    </Col>

                    <Col xs={12} sm={6} xl={4} className="mb-4">
                        <CounterWidget
                            category="Revenue"
                            title="$43,594"
                            period="Feb 1 - Apr 1"
                            percentage={28.4}
                            icon={faCashRegister}
                            iconColor="shape-tertiary"
                        />
                    </Col>

                    <Col xs={12} sm={6} xl={4} className="mb-4">
                        <CircleChartWidget
                            title="Traffic Share"
                            data={trafficShares} />
                    </Col>
                </Row>

                <Row>
                    <Col xs={12} xl={12} className="mb-4">
                        <Row>
                            <Col xs={12} xl={8} className="mb-4">
                                <Row>
                                    <Col xs={12} className="mb-4">
                                        <PageVisitsTable />
                                    </Col>

                                    <Col xs={12} lg={6} className="mb-4">
                                        <TeamMembersWidget />
                                    </Col>

                                    <Col xs={12} lg={6} className="mb-4">
                                        <ProgressTrackWidget />
                                    </Col>
                                </Row>
                            </Col>

                            <Col xs={12} xl={4}>
                                <Row>
                                    <Col xs={12} className="mb-4">
                                        <BarChartWidget
                                            title="Total orders"
                                            value={452}
                                            percentage={18.2}
                                            data={totalOrders} />
                                    </Col>

                                    <Col xs={12} className="px-0 mb-4">
                                        <RankingWidget />
                                    </Col>

                                    <Col xs={12} className="px-0">
                                        <AcquisitionWidget />
                                    </Col>
                                </Row>
                            </Col>
                        </Row>
                    </Col>
                </Row>
            </div>
        );
    }
}

export default withNavigation(connect(mapStateToProps, mapDispatchToProps)(DashboardOverviewComponent));
