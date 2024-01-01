import React from 'react';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import { CampaignsService, MapsService, UsersService } from 'therr-react/services';
import { IUserState, IUserConnectionsState, AccessCheckType } from 'therr-react/types';
import { UserConnectionsActions } from 'therr-react/redux/actions';
import { AccessLevels } from 'therr-js-utilities/constants';
import translator from '../../services/translator';
import BaseAcquisitionDashboard from './BaseAcquisitionDashboard';
import { getWebsiteName } from '../../utilities/getHostContext';

interface IAcquisitionOverviewDispatchProps {
    createUserConnection: Function;
    searchUserConnections: Function;
}

interface IStoreProps extends IAcquisitionOverviewDispatchProps {
    user: IUserState;
    userConnections: IUserConnectionsState;
}

// Regular component props
interface IAcquisitionOverviewProps extends IStoreProps {
    onInitMessaging?: Function;
}

interface IAcquisitionOverviewState {
}

const mapStateToProps = (state: any) => ({
    user: state.user,
    userConnections: state.userConnections,
});

const mapDispatchToProps = (dispatch: any) => bindActionCreators({
    createUserConnection: UserConnectionsActions.create,
    searchUserConnections: UserConnectionsActions.search,
}, dispatch);

const fetchMyCampaigns = () => CampaignsService.searchMyCampaigns({
    itemsPerPage: 50,
    pageNumber: 1,
});

/**
 * AcquisitionOverview
 */
export class AcquisitionOverviewComponent extends React.Component<IAcquisitionOverviewProps, IAcquisitionOverviewState> {
    private translate: Function;

    constructor(props: IAcquisitionOverviewProps) {
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
        document.title = `${getWebsiteName()} | ${this.translate('pages.acquisitionOverview.pageTitle')}`;

        if (!userConnections.connections.length) {
            this.props.searchUserConnections({
                filterBy: 'acceptingUserId',
                query: user.details.id,
                itemsPerPage: 50,
                pageNumber: 1,
                orderBy: 'interactionCount',
                order: 'desc',
                shouldCheckReverse: true,
            }, user.details.id).catch((err) => console.log(err));
        }
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
     * Clients of a white-label agency must be subscribed to view the campaigns dashboard
     */
    isSubscribed = () => {
        const { user } = this.props;

        return UsersService.isAuthorized(
            {
                type: AccessCheckType.ANY,
                levels: [
                    AccessLevels.DASHBOARD_SUBSCRIBER_BASIC,
                    AccessLevels.DASHBOARD_SUBSCRIBER_PREMIUM,
                    AccessLevels.DASHBOARD_SUBSCRIBER_PRO,
                    AccessLevels.DASHBOARD_SUBSCRIBER_AGENCY,
                ],
            },
            user,
        );
    };

    // eslint-disable-next-line class-methods-use-this
    public render(): JSX.Element | null {
        return (
            <BaseAcquisitionDashboard fetchCampaigns={fetchMyCampaigns} isSuperAdmin={false} isSubscriber={this.isSubscribed()} />
        );
    }
}

export default connect(mapStateToProps, mapDispatchToProps)(AcquisitionOverviewComponent);
