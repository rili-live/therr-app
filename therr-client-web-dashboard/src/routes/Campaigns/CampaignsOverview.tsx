import React from 'react';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import { MapsService } from 'therr-react/services';
import { IUserState, IUserConnectionsState } from 'therr-react/types';
import { UserConnectionsActions } from 'therr-react/redux/actions';
import translator from '../../services/translator';
import BaseAcquisitionDashboard from './BaseCampaignsOverview';

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
        document.title = `Therr for Business | ${this.translate('pages.campaignsOverview.pageTitle')}`;

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
            <BaseAcquisitionDashboard isSuperAdmin={false} />
        );
    }
}

export default connect(mapStateToProps, mapDispatchToProps)(CampaignsOverviewComponent);
