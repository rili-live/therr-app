import React from 'react';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import { NavigateFunction } from 'react-router-dom';
import moment from 'moment-timezone';
import {
    FontAwesomeIcon,
} from '@fortawesome/react-fontawesome';
import {
    faChevronLeft,
    faChevronRight,
    faPencilRuler,
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
// import {
//     CounterWidget,
//     CircleChartWidget,
//     BarChartWidget,
//     TeamMembersWidget,
//     ProgressTrackWidget,
//     RankingWidget,
//     AcquisitionWidget,
// } from '../components/Widgets';
// import {
//     PageVisitsTable,
// } from '../components/Tables';
// import {
//     trafficShares,
//     totalOrders,
// } from '../data/charts';
import { SpaceMetricsDisplay } from '../components/widgets/SpaceMetricsDisplay';
import ManageSpacesMenu from '../components/ManageSpacesMenu';
import { ISpace } from '../types';

const populateEmptyMetrics = (timeSpan: 'week' | 'month') => {
    // TODO: Update this to support more than 1 month time span
    // by dynamically determine days in the "previous" month
    const labelsLength = timeSpan === 'week' ? 7 : 31;
    const startDay = Number(moment().subtract(labelsLength, 'd').format('D'));
    const startMonth = Number(moment().subtract(labelsLength, 'd').format('M'));
    const daysInFirstMonth = moment().subtract(labelsLength, 'd').daysInMonth();
    const daysInNextMonth = moment().daysInMonth();
    const daysInLastMonth = moment().add(1, 'M').daysInMonth();
    const currentMonthIndex = 0;
    let currentMonth = startMonth;

    return Array.from({ length: labelsLength }, (_, i) => {
        let day = startDay + i + 1;
        const daysInCurrentMonth = [daysInFirstMonth, daysInNextMonth, daysInLastMonth][currentMonthIndex];
        if (day > daysInCurrentMonth) {
            day -= daysInCurrentMonth;
            if (day > daysInNextMonth) {
                day -= daysInNextMonth;
            }
        }
        if (day === 1 && day !== startDay + 1) {
            currentMonth += 1;
        }
        return [`${currentMonth}/${day}`, 0];
    }).reduce((acc, cur) => ({
        ...acc,
        [cur[0]]: cur[1],
    }), {});
};

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
    currentSpaceIndex: number;
    metrics: any[];
    impressionsLabels: string[] | undefined;
    impressionsValues: number[][] | undefined;
    percentageChange: number;
    spacesInView: ISpace[]; // TODO: Move to Redux
    spanOfTime: 'week' | 'month';
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
            currentSpaceIndex: 0,
            impressionsLabels: undefined,
            impressionsValues: undefined,
            metrics: [],
            percentageChange: 0,
            spacesInView: [],
            spanOfTime: 'week',
        };

        this.translate = (key: string, params: any) => translator('en-us', key, params);
    }

    componentDidMount() {
        const {
            user,
            userConnections,
        } = this.props;
        document.title = `Therr for Business | ${this.translate('pages.dashboardOverview.pageTitle')}`;
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

    fetchMySpaces = () => MapsService.searchMySpaces({
        itemsPerPage: 50,
        pageNumber: 1,
    }).then((response) => new Promise((resolve) => {
        this.setState({
            spacesInView: response?.data?.results || [],
        }, () => resolve(null));
    }));

    fetchSpaceMetrics = (timeSpan: 'week' | 'month') => {
        this.setState({
            spanOfTime: timeSpan,
        });
        const { spacesInView } = this.state;

        const startDate = moment().subtract(1, `${timeSpan}s`).utc().format('YYYY-MM-DD HH:mm:ss');
        const endDate = moment().utc().format('YYYY-MM-DD HH:mm:ss');
        let formattedMetrics = populateEmptyMetrics(timeSpan);
        const prefetchPromise: Promise<any> = !spacesInView.length ? this.fetchMySpaces() : Promise.resolve();

        prefetchPromise.then(() => {
            const { currentSpaceIndex, spacesInView: updatedSpacesInView } = this.state;

            if (updatedSpacesInView.length) {
                // TODO: get current user spaces
                MapsService.getSpaceMetrics(updatedSpacesInView[currentSpaceIndex].id, {
                    startDate,
                    endDate,
                }).then((response) => {
                    // TODO: Account for different metric names and value types
                    formattedMetrics = {
                        ...formattedMetrics,
                        ...(response?.data?.aggregations.metrics || [])
                    };

                    this.setState({
                        metrics: response.data.metrics,
                        percentageChange: response.data.aggregations.previousSeriesPct,
                        impressionsLabels: Object.keys(formattedMetrics),
                        impressionsValues: [Object.values(formattedMetrics)],
                    });
                }).catch((err) => {
                    console.log(err);
                });
            }
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

    navigateHandler = (routeName: string) => () => this.props.navigation.navigate(routeName);

    onPrevSpaceClick = () => {
        const {
            currentSpaceIndex,
            spanOfTime,
        } = this.state;
        if (currentSpaceIndex > 0) {
            this.setState({
                currentSpaceIndex: currentSpaceIndex - 1,
            }, () => {
                this.fetchSpaceMetrics(spanOfTime);
            });
        }
    };

    onNextSpaceClick = () => {
        const {
            currentSpaceIndex,
            spacesInView,
            spanOfTime,
        } = this.state;
        if (currentSpaceIndex < spacesInView.length - 1) {
            this.setState({
                currentSpaceIndex: currentSpaceIndex + 1,
            }, () => {
                this.fetchSpaceMetrics(spanOfTime);
            });
        }
    };

    public render(): JSX.Element | null {
        const {
            currentSpaceIndex,
            spacesInView,
            impressionsLabels,
            impressionsValues,
            metrics,
            percentageChange
        } = this.state;

        return (
            <div id="page_dashboard_overview" className="flex-box column">
                <div className="d-flex justify-content-around justify-content-md-between flex-wrap flex-md-nowrap align-items-center py-4">
                    <ManageSpacesMenu
                        className="mb-2 mb-md-0"
                        navigateHandler={this.navigateHandler}
                    />

                    <ButtonGroup className="mb-2 mb-md-0">
                        {
                            currentSpaceIndex !== 0
                                && <Button onClick={this.onPrevSpaceClick} variant="outline-primary" size="sm">
                                    <FontAwesomeIcon icon={faChevronLeft} className="me-2" /> Prev. Space
                                </Button>
                        }
                        {
                            currentSpaceIndex < spacesInView.length - 1
                                && <Button onClick={this.onNextSpaceClick} variant="outline-primary" size="sm">
                                    Next Space <FontAwesomeIcon icon={faChevronRight} className="me-2" />
                                </Button>
                        }
                    </ButtonGroup>
                </div>

                <Row className="justify-content-md-center">
                    <Col xs={12} className="mb-4 d-none d-sm-block">
                        <SpaceMetricsDisplay
                            isMobile={false}
                            title={`Space Metrics: ${spacesInView[currentSpaceIndex] ? spacesInView[currentSpaceIndex].notificationMsg : 'No Data'}`}
                            value={metrics.length}
                            labels={impressionsLabels}
                            values={impressionsValues}
                            percentage={percentageChange}
                            fetchSpaceMetrics={this.fetchSpaceMetrics}
                        />
                    </Col>
                    <Col xs={12} className="mb-4 d-sm-none">
                        <SpaceMetricsDisplay
                            isMobile={true}
                            title={`Space Metrics: ${spacesInView[currentSpaceIndex] ? spacesInView[currentSpaceIndex].notificationMsg : 'No Data'}`}
                            value={metrics.length}
                            labels={impressionsLabels}
                            values={impressionsValues}
                            percentage={percentageChange}
                            fetchSpaceMetrics={this.fetchSpaceMetrics}
                        />
                    </Col>
                    {/* <Col xs={12} sm={6} xl={4} className="mb-4">
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
                    </Col> */}
                </Row>

                {/* <Row>
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
                </Row> */}
            </div>
        );
    }
}

export default withNavigation(connect(mapStateToProps, mapDispatchToProps)(DashboardOverviewComponent));
