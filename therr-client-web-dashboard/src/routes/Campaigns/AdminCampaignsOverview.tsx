import React from 'react';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import { MapsService, UsersService } from 'therr-react/services';
import { IUserState, IUserConnectionsState, AccessCheckType } from 'therr-react/types';
import { UserConnectionsActions } from 'therr-react/redux/actions';
import { AccessLevels } from 'therr-js-utilities/constants';
import translator from '../../services/translator';
import BaseCampaignsOverview from './BaseCampaignsOverview';
import { DEFAULT_COORDINATES } from '../../constants/LocationDefaults';
import { getWebsiteName } from '../../utilities/getHostContext';

interface IAdminCampaignsOverviewDispatchProps {
    createUserConnection: Function;
    searchUserConnections: Function;
}

interface IStoreProps extends IAdminCampaignsOverviewDispatchProps {
    user: IUserState;
    userConnections: IUserConnectionsState;
}

// Regular component props
interface IAdminCampaignsOverviewProps extends IStoreProps {
    onInitMessaging?: Function;
}

interface IAdminCampaignsOverviewState {
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
 * AdminCampaignsOverview
 */
export class AdminCampaignsOverviewComponent extends React.Component<IAdminCampaignsOverviewProps, IAdminCampaignsOverviewState> {
    private translate: Function;

    constructor(props: IAdminCampaignsOverviewProps) {
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
        document.title = `${getWebsiteName()} | ${this.translate('pages.adminCampaignsOverview.pageTitle')}`;
    }

    getConnectionDetails = (connection) => {
        const { user } = this.props;

        return connection.users.find((u) => u.id !== user.details.id);
    };

    handleInitMessaging = (e, connection) => {
        const { onInitMessaging } = this.props;
        return onInitMessaging && onInitMessaging(e, this.getConnectionDetails(connection), 'user-profile');
    };

    /**
     * Marketing agency admins must be subscribed to a monthly white-label plan to view campaigns
    */
    isSubscribed = () => {
        const { user } = this.props;

        return UsersService.isAuthorized(
            {
                type: AccessCheckType.ALL,
                levels: [AccessLevels.DASHBOARD_SUBSCRIBER_AGENCY],
                isPublic: true,
            },
            user,
        );
    };

    // eslint-disable-next-line class-methods-use-this
    public render(): JSX.Element | null {
        return (
            <BaseCampaignsOverview isSuperAdmin={true} isSubscriber={this.isSubscribed()} />
        );
    }
}

export default connect(mapStateToProps, mapDispatchToProps)(AdminCampaignsOverviewComponent);
