import React from 'react';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import { MapsService, UsersService } from 'therr-react/services';
import { IUserState, IUserConnectionsState, AccessCheckType } from 'therr-react/types';
import { UserConnectionsActions } from 'therr-react/redux/actions';
import { AccessLevels } from 'therr-js-utilities/constants';
import translator from '../../services/translator';
import BaseCampaignsOverview from './BaseCampaignsOverview';
import { getWebsiteName } from '../../utilities/getHostContext';

interface ICampaignsOverviewDispatchProps {
    createUserConnection: Function;
    searchUserConnections: Function;
}

interface IStoreProps extends ICampaignsOverviewDispatchProps {
    user: IUserState;
    userConnections: IUserConnectionsState;
}

// Regular component props
interface ICampaignsOverviewProps extends IStoreProps {
    onInitMessaging?: Function;
}

interface ICampaignsOverviewState {
}

const mapStateToProps = (state: any) => ({
    user: state.user,
    userConnections: state.userConnections,
});

const mapDispatchToProps = (dispatch: any) => bindActionCreators({
    createUserConnection: UserConnectionsActions.create,
    searchUserConnections: UserConnectionsActions.search,
}, dispatch);

const fetchMySpaces = () => MapsService.searchMySpaces({
    itemsPerPage: 50,
    pageNumber: 1,
});

/**
 * CampaignsOverview
 */
export class CampaignsOverviewComponent extends React.Component<ICampaignsOverviewProps, ICampaignsOverviewState> {
    private translate: Function;

    constructor(props: ICampaignsOverviewProps) {
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
        document.title = `${getWebsiteName()} | ${this.translate('pages.campaignsOverview.pageTitle')}`;

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
                levels: [AccessLevels.DASHBOARD_SUBSCRIBER_BASIC, AccessLevels.DASHBOARD_SUBSCRIBER_PREMIUM, AccessLevels.DASHBOARD_SUBSCRIBER_PRO],
                isPublic: true,
            },
            user,
        );
    };

    // eslint-disable-next-line class-methods-use-this
    public render(): JSX.Element | null {
        return (
            <BaseCampaignsOverview isSuperAdmin={false} isSubscriber={this.isSubscribed()} />
        );
    }
}

export default connect(mapStateToProps, mapDispatchToProps)(CampaignsOverviewComponent);
