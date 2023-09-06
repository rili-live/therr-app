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
import { MapsService, ReactionsService, UsersService } from 'therr-react/services';
import { IUserState, IUserConnectionsState, AccessCheckType } from 'therr-react/types';
import { AccessLevels, MetricNames } from 'therr-js-utilities/constants';
import translator from '../../services/translator';
import withNavigation from '../../wrappers/withNavigation';
import ManageSpacesMenu from '../../components/ManageSpacesMenu';
import { ISpace } from '../../types';
import AdminManageSpacesMenu from '../../components/AdminManageSpacesMenu';
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
    fetchSpaces: (latitude?: number, longitude?: number) => Promise<AxiosResponse<any, any>>;
    isSuperAdmin: boolean;
}

interface IBaseDashboardState {
    currentSpaceIndex: number;
    latitude?: number;
    longitude?: number;
    isLoadingSpaces: boolean;
    overviewGraphLabels: string[] | undefined;
    overviewGraphValues: number[][] | undefined;
    percentageChange: number;
    totalImpressions: number;
    spacesInView: ISpace[]; // TODO: Move to Redux
    spanOfTime: 'week' | 'month';
    averageRating: number;
    totalRating: number;
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
            isLoadingSpaces: false,
            percentageChange: 0,
            totalImpressions: 0,
            spacesInView: [],
            spanOfTime: 'week',
            averageRating: 0,
            totalRating: 0,

        };

        this.translate = (key: string, params: any) => translator('en-us', key, params);
    }

    componentDidMount() {
        if (!this.state.overviewGraphValues?.length) {
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
        const prefetchPromise: Promise<any> = !spacesInView.length ? this.fetchDashboardSpaces(latitude, longitude) : Promise.resolve();

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
                        totalImpressions: impressions.metrics
                            ? Object.values(impressions.metrics as { [key: string]: number })
                                .reduce((acc: number, cur: number) => acc + cur, 0)
                            : 0,
                        overviewGraphLabels: Object.keys(emptyMetrics),
                        overviewGraphValues: [Object.values(formattedVisits), Object.values(formattedImpressions), Object.values(formattedProspects)],
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
            currentSpaceIndex,
            spacesInView,
            isLoadingSpaces,
            overviewGraphLabels,
            overviewGraphValues,
            percentageChange,
            averageRating,
            totalRating,
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

        return (
            <div id="page_dashboard_overview" className="flex-box column">
                {
                    (spacesInView?.length > 0 || isLoadingSpaces)
                    && <OverviewOfSpaceMetrics
                        navigateHandler={this.navigateHandler}
                        onPrevSpaceClick={this.onPrevSpaceClick}
                        onNextSpaceClick={this.onNextSpaceClick}
                        currentSpaceIndex={currentSpaceIndex}
                        overviewGraphLabels={overviewGraphLabels}
                        overviewGraphValues={overviewGraphValues}
                        percentageChange={percentageChange}
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
