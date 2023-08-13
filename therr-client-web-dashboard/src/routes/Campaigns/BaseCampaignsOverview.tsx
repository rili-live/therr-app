import React from 'react';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import { NavigateFunction } from 'react-router-dom';
import {
    Col,
    Row,
} from 'react-bootstrap';
import { IUserState } from 'therr-react/types';
import translator from '../../services/translator';
import withNavigation from '../../wrappers/withNavigation';
import ManageSpacesMenu from '../../components/ManageSpacesMenu';
import AdminManageSpacesMenu from '../../components/AdminManageSpacesMenu';
import PricingCards from '../../components/PricingCards';

interface IBaseCampaignsOverviewRouterProps {
    navigation: {
        navigate: NavigateFunction;
    }
}

interface IBaseCampaignsOverviewDispatchProps {
}

interface IStoreProps extends IBaseCampaignsOverviewDispatchProps {
    user: IUserState;
}

// Regular component props
interface IBaseCampaignsOverviewProps extends IBaseCampaignsOverviewRouterProps, IStoreProps {
    isSuperAdmin: boolean;
}

interface IBaseCampaignsOverviewState {
}

const mapStateToProps = (state: any) => ({
    user: state.user,
});

const mapDispatchToProps = (dispatch: any) => bindActionCreators({
}, dispatch);

/**
 * BaseCampaignsOverview
 */
export class BaseCampaignsOverviewComponent extends React.Component<IBaseCampaignsOverviewProps, IBaseCampaignsOverviewState> {
    private translate: Function;

    constructor(props: IBaseCampaignsOverviewProps) {
        super(props);

        this.state = {
        };

        this.translate = (key: string, params: any) => translator('en-us', key, params);
    }

    navigateHandler = (routeName: string) => () => this.props.navigation.navigate(routeName);

    public render(): JSX.Element | null {
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
                </div>

                <Row className="justify-content-md-center">
                    <Col xs={12} className="mb-4 d-sm-block">
                        <PricingCards eventSource="campaigns-overview" />
                    </Col>
                </Row>
            </div>
        );
    }
}

export default withNavigation(connect(mapStateToProps, mapDispatchToProps)(BaseCampaignsOverviewComponent));
