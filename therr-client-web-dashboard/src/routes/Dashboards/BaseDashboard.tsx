import React from 'react';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import { NavigateFunction } from 'react-router-dom';
import { AxiosResponse } from 'axios';
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
import { MapsService } from 'therr-react/services';
import { IUserState, IUserConnectionsState } from 'therr-react/types';
import { MetricNames } from 'therr-js-utilities/constants';
import translator from '../../services/translator';
import withNavigation from '../../wrappers/withNavigation';
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
import { SpaceMetricsDisplay } from '../../components/widgets/SpaceMetricsDisplay';
import ManageSpacesMenu from '../../components/ManageSpacesMenu';
import { ISpace } from '../../types';
import AdminManageSpacesMenu from '../../components/AdminManageSpacesMenu';

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

interface IBaseDashboardRouterProps {
    navigation: {
        navigate: NavigateFunction;
    }
}

interface IBaseDashboardDispatchProps {
}

interface IStoreProps extends IBaseDashboardDispatchProps {
    user: IUserState;
}

// Regular component props
interface IBaseDashboardProps extends IBaseDashboardRouterProps, IStoreProps {
    fetchSpaces: () => Promise<AxiosResponse<any, any>>;
    isSuperAdmin: boolean;
}

interface IBaseDashboardState {
    currentSpaceIndex: number;
    overviewGraphLabels: string[] | undefined;
    overviewGraphValues: number[][] | undefined;
    percentageChange: number;
    spacesInView: ISpace[]; // TODO: Move to Redux
    spanOfTime: 'week' | 'month';
}

const mapStateToProps = (state: any) => ({
    user: state.user,
});

const mapDispatchToProps = (dispatch: any) => bindActionCreators({
}, dispatch);

/**
 * BaseDashboard
 */
export class BaseDashboardComponent extends React.Component<IBaseDashboardProps, IBaseDashboardState> {
    private translate: Function;

    constructor(props: IBaseDashboardProps) {
        super(props);

        this.state = {
            currentSpaceIndex: 0,
            overviewGraphLabels: undefined,
            overviewGraphValues: undefined,
            percentageChange: 0,
            spacesInView: [],
            spanOfTime: 'week',
        };

        this.translate = (key: string, params: any) => translator('en-us', key, params);
    }

    componentDidMount() {
        if (!this.state.overviewGraphValues?.length) {
            this.fetchSpaceMetrics('week');
        }
    }

    fetchDashboardSpaces = () => {
        const { fetchSpaces } = this.props;

        return fetchSpaces().then((response) => new Promise((resolve) => {
            this.setState({
                spacesInView: response?.data?.results || [],
            }, () => resolve(null));
        }));
    };

    fetchSpaceMetrics = (timeSpan: 'week' | 'month') => {
        this.setState({
            spanOfTime: timeSpan,
        });
        const { spacesInView } = this.state;

        const startDate = moment().subtract(1, `${timeSpan}s`).utc().format('YYYY-MM-DD HH:mm:ss');
        const endDate = moment().utc().format('YYYY-MM-DD HH:mm:ss');
        const emptyMetrics = populateEmptyMetrics(timeSpan);
        let formattedProspects = emptyMetrics;
        let formattedImpressions = emptyMetrics;
        let formattedVisits = emptyMetrics;
        const prefetchPromise: Promise<any> = !spacesInView.length ? this.fetchDashboardSpaces() : Promise.resolve();

        prefetchPromise.then(() => {
            const { currentSpaceIndex, spacesInView: updatedSpacesInView } = this.state;

            if (updatedSpacesInView.length) {
                // TODO: get current user spaces
                MapsService.getSpaceMetrics(updatedSpacesInView[currentSpaceIndex].id, {
                    startDate,
                    endDate,
                }).then((response) => {
                    const prospects = response?.data?.aggregations?.[MetricNames.SPACE_PROSPECT] || {};
                    const impressions = response?.data?.aggregations?.[MetricNames.SPACE_IMPRESSION] || {};
                    const visits = response?.data?.aggregations?.[MetricNames.SPACE_VISIT] || {};
                    formattedProspects = {
                        ...formattedProspects,
                        ...prospects.metrics,
                    };
                    formattedImpressions = {
                        ...formattedImpressions,
                        ...impressions.metrics,
                    };
                    formattedVisits = {
                        ...formattedVisits,
                        ...visits.metrics,
                    };

                    this.setState({
                        percentageChange: impressions.previousSeriesPct,
                        overviewGraphLabels: Object.keys(emptyMetrics),
                        overviewGraphValues: [Object.values(formattedVisits), Object.values(formattedImpressions), Object.values(formattedProspects)],
                    });
                }).catch((err) => {
                    console.log(err);
                });
            }
        });
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
            overviewGraphLabels,
            overviewGraphValues,
            percentageChange,
        } = this.state;
        const {
            isSuperAdmin,
        } = this.props;

        return (
            <div id="page_dashboard_overview" className="flex-box column">
                <div className="d-flex justify-content-around justify-content-md-between flex-wrap flex-md-nowrap align-items-center py-4">
                    {
                        isSuperAdmin && <AdminManageSpacesMenu className="mb-2 mb-md-0" navigateHandler={this.navigateHandler} />
                    }
                    {
                        !isSuperAdmin && <ManageSpacesMenu className="mb-2 mb-md-0" navigateHandler={this.navigateHandler} />
                    }
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
                            labels={overviewGraphLabels}
                            values={overviewGraphValues}
                            percentage={percentageChange}
                            fetchSpaceMetrics={this.fetchSpaceMetrics}
                        />
                    </Col>
                    <Col xs={12} className="mb-4 d-sm-none">
                        <SpaceMetricsDisplay
                            isMobile={true}
                            title={`Space Metrics: ${spacesInView[currentSpaceIndex] ? spacesInView[currentSpaceIndex].notificationMsg : 'No Data'}`}
                            labels={overviewGraphLabels}
                            values={overviewGraphValues}
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

export default withNavigation(connect(mapStateToProps, mapDispatchToProps)(BaseDashboardComponent));
