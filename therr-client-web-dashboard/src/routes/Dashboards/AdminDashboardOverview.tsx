import React from 'react';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import { MapsService } from 'therr-react/services';
import { IUserState, IUserConnectionsState } from 'therr-react/types';
import { UserConnectionsActions } from 'therr-react/redux/actions';
import translator from '../../services/translator';
import BaseDashboard from './BaseDashboard';

interface IAdminDashboardOverviewDispatchProps {
    createUserConnection: Function;
    searchUserConnections: Function;
}

interface IStoreProps extends IAdminDashboardOverviewDispatchProps {
    user: IUserState;
    userConnections: IUserConnectionsState;
}

// Regular component props
interface IAdminDashboardOverviewProps extends IStoreProps {
    onInitMessaging?: Function;
}

interface IAdminDashboardOverviewState {
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
    latitude: latitude || 32.8205566, // defaults to Dallas, TX
    longitude: longitude || -96.8963576, // defaults to Dallas, TX
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
        document.title = `Therr for Business | ${this.translate('pages.adminDashboardOverview.pageTitle')}`;
    }

    getConnectionDetails = (connection) => {
        const { user } = this.props;

        return connection.users.find((u) => u.id !== user.details.id);
    };

    handleInitMessaging = (e, connection) => {
        const { onInitMessaging } = this.props;
        return onInitMessaging && onInitMessaging(e, this.getConnectionDetails(connection), 'user-profile');
    };

    // eslint-disable-next-line class-methods-use-this
    public render(): JSX.Element | null {
        return (
            <BaseDashboard fetchSpaces={fetchAllSpaces} isSuperAdmin={true} />
        );
    }
}

export default connect(mapStateToProps, mapDispatchToProps)(AdminDashboardOverviewComponent);
