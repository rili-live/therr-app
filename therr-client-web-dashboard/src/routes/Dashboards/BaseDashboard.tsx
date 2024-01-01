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
    faMapMarked,
    faSearch,
} from '@fortawesome/free-solid-svg-icons';
import {
    Button,
    ButtonGroup,
} from '@themesberg/react-bootstrap';
import {
    ReactionsService,
    UsersService,
    IGetSpaceMetricsArgs,
    IGetSpaceEngagementArgs,
} from 'therr-react/services';
import { IUserState, IUserConnectionsState, AccessCheckType } from 'therr-react/types';
import { AccessLevels, MetricNames } from 'therr-js-utilities/constants';
import { MapActions } from 'therr-react/redux/actions';
import translator from '../../services/translator';
import withNavigation from '../../wrappers/withNavigation';
import { ISpace } from '../../types';
import OverviewOfSpaceMetrics from './OverviewModules/OverviewOfSpaceMetrics';

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
    getSpaceEngagement: (spaceId: string, args: IGetSpaceEngagementArgs) => any;
    getSpaceMetrics: (spaceId: string, args: IGetSpaceMetricsArgs) => any;
    fetchSpaces: (latitude?: number, longitude?: number) => Promise<AxiosResponse<any, any>>;
    isSuperAdmin: boolean;
}

interface IBaseDashboardState {
    currentSpaceIndex: number;
    latitude?: number;
    longitude?: number;
    isLoadingSpaces: boolean;
    baseMetricsGraphLabels: string[] | undefined;
    baseMetricsGraphValues: number[][] | undefined;
    baseMetricsPercentChange: number;
    engagementMetricsGraphLabels: string[] | undefined;
    engagementMetricsGraphValues: number[][] | undefined;
    engagementMetricsPercentChange: number;
    totalEngagements: number;
    totalImpressions: number;
    spacesInView: ISpace[]; // TODO: This helps distinguish between my spaces and an admin viewing all spaces
    spanOfTime: 'week' | 'month';
    averageRating: number;
    totalRating: number;
}

const mapStateToProps = (state: any) => ({
    user: state.user,
});

const mapDispatchToProps = (dispatch: any) => bindActionCreators({
    getSpaceEngagement: MapActions.getSpaceEngagement,
    getSpaceMetrics: MapActions.getSpaceMetrics,
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
            baseMetricsGraphLabels: undefined,
            baseMetricsGraphValues: undefined,
            baseMetricsPercentChange: 0,
            engagementMetricsGraphLabels: undefined,
            engagementMetricsGraphValues: undefined,
            engagementMetricsPercentChange: 0,
            isLoadingSpaces: false,
            totalEngagements: 0,
            totalImpressions: 0,
            spacesInView: [],
            spanOfTime: 'week',
            averageRating: 0,
            totalRating: 0,

        };

        this.translate = (key: string, params: any) => translator('en-us', key, params);
    }

    componentDidMount() {
        if (!this.state.baseMetricsGraphValues?.length) {
            this.fetchSpaceMetrics('week');
        }
        this.fetchSpaceReactions();
    }

    fetchSpaceReactions = () => {
        const { spacesInView, currentSpaceIndex } = this.state;

        if (spacesInView[currentSpaceIndex]) {
            const spaceId = spacesInView[currentSpaceIndex].id;

            ReactionsService.getSpaceRatings(spaceId)
                .then((response) => {
                    this.setState({
                        averageRating: response?.data?.avgRating,
                        totalRating: response?.data?.totalRatings,
                    });
                })
                .catch((err) => {
                    console.error('Error fetching space ratings:', err);
                });
        }
    };

    fetchDashboardSpaces = (latitude?: number, longitude?: number) => {
        const { fetchSpaces } = this.props;

        return fetchSpaces(latitude, longitude).then((response) => new Promise((resolve) => {
            this.setState({
                spacesInView: response?.data?.results || [],
            }, () => resolve(null));
        })).then(() => {
            this.fetchSpaceReactions();
        });
    };

    fetchSpaceMetrics = (timeSpan: 'week' | 'month') => {
        const { getSpaceMetrics, getSpaceEngagement } = this.props;
        this.setState({
            spanOfTime: timeSpan,
        });
        const { latitude, longitude, spacesInView } = this.state;
        this.setState({
            isLoadingSpaces: true,
        });

        const startDate = moment().subtract(1, `${timeSpan}s`).utc().format('YYYY-MM-DD HH:mm:ss');
        const endDate = moment().utc().format('YYYY-MM-DD HH:mm:ss');
        const emptyMetrics = populateEmptyMetrics(timeSpan);
        let formattedProspects = emptyMetrics;
        let formattedImpressions = emptyMetrics;
        let formattedVisits = emptyMetrics;
        let formattedLikes = emptyMetrics;
        let formattedCheckIns = emptyMetrics;
        let formattedMoments = emptyMetrics;
        const prefetchPromise: Promise<any> = !spacesInView.length ? this.fetchDashboardSpaces(latitude, longitude) : Promise.resolve();

        prefetchPromise.then(() => {
            const { currentSpaceIndex, spacesInView: updatedSpacesInView } = this.state;

            if (updatedSpacesInView.length) {
                // TODO: get current user spaces and organization spaces. This should be on the backend. Verify it is working as expected
                Promise.all(
                    [
                        getSpaceMetrics(updatedSpacesInView[currentSpaceIndex].id, {
                            startDate,
                            endDate,
                        }),
                        getSpaceEngagement(updatedSpacesInView[currentSpaceIndex].id, {
                            startDate,
                            endDate,
                        }),
                    ],
                ).then(([metricsResponse, engagementsResponse]) => {
                    const prospects = metricsResponse?.aggregations?.[MetricNames.SPACE_PROSPECT] || {};
                    const impressions = metricsResponse?.aggregations?.[MetricNames.SPACE_IMPRESSION] || {};
                    const visits = metricsResponse?.aggregations?.[MetricNames.SPACE_VISIT] || {};
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

                    const likes = engagementsResponse?.aggregations?.[MetricNames.SPACE_LIKE] || {};
                    const checkIns = engagementsResponse?.aggregations?.[MetricNames.SPACE_USER_CHECK_IN] || {};
                    const moments = engagementsResponse?.aggregations?.[MetricNames.SPACE_MOMENT_CREATED] || {};
                    formattedLikes = {
                        ...formattedLikes,
                        ...likes.metrics,
                    };
                    formattedCheckIns = {
                        ...formattedCheckIns,
                        ...checkIns.metrics,
                    };
                    formattedMoments = {
                        ...formattedMoments,
                        ...moments.metrics,
                    };
                    const totalImpressions = impressions.metrics
                        ? Object.values(impressions.metrics as { [key: string]: number })
                            .reduce((acc: number, cur: number) => acc + cur, 0)
                        : 0;
                    const totalCheckIns = checkIns.metrics
                        ? Object.values(checkIns.metrics as { [key: string]: number })
                            .reduce((acc: number, cur: number) => acc + cur, 0)
                        : 0;
                    const totalLikes = likes.metrics
                        ? Object.values(likes.metrics as { [key: string]: number })
                            .reduce((acc: number, cur: number) => acc + cur, 0)
                        : 0;
                    const totalMoments = moments.metrics
                        ? Object.values(moments.metrics as { [key: string]: number })
                            .reduce((acc: number, cur: number) => acc + cur, 0)
                        : 0;

                    this.setState({
                        totalEngagements: totalCheckIns + totalLikes + totalMoments,
                        totalImpressions,
                        baseMetricsGraphLabels: Object.keys(emptyMetrics),
                        baseMetricsGraphValues: [Object.values(formattedVisits), Object.values(formattedImpressions), Object.values(formattedProspects)],
                        baseMetricsPercentChange: impressions.previousSeriesPct,
                        engagementMetricsGraphLabels: Object.keys(emptyMetrics),
                        engagementMetricsGraphValues: [Object.values(formattedLikes), Object.values(formattedCheckIns), Object.values(formattedMoments)],
                        engagementMetricsPercentChange: Math.ceil((
                            (likes.previousSeriesPct || 0) + (checkIns.previousSeriesPct || 0) + (moments.previousSeriesPct || 0)
                        ) / 3),
                    });
                }).catch((err) => {
                    console.log(err);
                });
            }
        }).catch((err) => {
            console.log(err);
        }).finally(() => {
            this.setState({
                isLoadingSpaces: false,
            });
        });
    };

    navigateHandler = (routeName: string) => () => this.props.navigation.navigate(routeName);

    onChangeTimeSpan = (spanOfTime: 'week' | 'month') => {
        if (spanOfTime !== this.state.spanOfTime) {
            this.fetchSpaceMetrics(spanOfTime);
        }
        this.setState({
            spanOfTime,
        });
    };

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
                this.fetchSpaceReactions();
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
                this.fetchSpaceReactions();
            });
        }
    };

    isSubscribed = () => {
        const { user } = this.props;

        return UsersService.isAuthorized(
            {
                type: AccessCheckType.ANY,
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
            currentSpaceIndex,
            spacesInView,
            isLoadingSpaces,
            baseMetricsGraphLabels,
            baseMetricsGraphValues,
            baseMetricsPercentChange,
            engagementMetricsGraphLabels,
            engagementMetricsGraphValues,
            engagementMetricsPercentChange,
            averageRating,
            totalRating,
            totalEngagements,
            totalImpressions,
            spanOfTime,
        } = this.state;
        const {
            isSuperAdmin,
            user,
        } = this.props;

        const avgImpressions = spanOfTime === 'week'
            ? Math.ceil(totalImpressions / 7)
            : Math.ceil(totalImpressions / 30);

        const avgEngagements = spanOfTime === 'week'
            ? Math.ceil(totalEngagements / 7)
            : Math.ceil(totalEngagements / 30);

        return (
            <div id="page_dashboard_overview" className="flex-box column">
                {
                    (spacesInView?.length > 0 || isLoadingSpaces)
                    && <OverviewOfSpaceMetrics
                        navigateHandler={this.navigateHandler}
                        onPrevSpaceClick={this.onPrevSpaceClick}
                        onNextSpaceClick={this.onNextSpaceClick}
                        currentSpaceIndex={currentSpaceIndex}
                        baseEngagements={{
                            graphLabels: engagementMetricsGraphLabels,
                            graphValues: engagementMetricsGraphValues,
                            percentageChange: engagementMetricsPercentChange,
                        }}
                        baseMetrics={{
                            graphLabels: baseMetricsGraphLabels,
                            graphValues: baseMetricsGraphValues,
                            percentageChange: baseMetricsPercentChange,
                        }}
                        avgEngagements={avgEngagements}
                        avgImpressions={avgImpressions}
                        spacesInView={spacesInView}
                        spanOfTime={spanOfTime}
                        averageRating={averageRating}
                        totalRating={totalRating}
                        onChangeTimeSpan={this.onChangeTimeSpan}
                        isLoading={isLoadingSpaces}
                        isSuperAdmin={isSuperAdmin}
                        user={user}
                    />
                }
                {
                    (!spacesInView?.length && !isLoadingSpaces)
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
            </div>
        );
    }
}

export default withNavigation(connect(mapStateToProps, mapDispatchToProps)(BaseDashboardComponent));
