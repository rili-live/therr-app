/* eslint-disable max-len */
import React from 'react';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import { Link, NavigateFunction } from 'react-router-dom';
import {
    Col,
    Row,
    Button,
    Dropdown,
    ButtonGroup,
    Toast,
    ToastContainer,
    Card,
} from 'react-bootstrap';
import { UserConnectionsActions } from 'therr-react/redux/actions';
import { UsersService } from 'therr-react/services';
import { IUserState, IUserConnectionsState } from 'therr-react/types';
import translator from '../../services/translator';
import withNavigation from '../../wrappers/withNavigation';

interface IDocumentationOverviewRouterProps {
    navigation: {
        navigate: NavigateFunction;
    }
}

interface IDocumentationOverviewDispatchProps {
    searchUserConnections: Function;
}

interface IStoreProps extends IDocumentationOverviewDispatchProps {
    user: IUserState;
    userConnections: IUserConnectionsState;
}

// Regular component props
interface IDocumentationOverviewProps extends IDocumentationOverviewRouterProps, IStoreProps {
    onInitMessaging?: Function;
}

interface IDocumentationOverviewState {
    alertIsVisible: boolean;
    alertVariation: string;
    alertTitle: string;
    alertMessage: string;
}

const mapStateToProps = (state: any) => ({
    user: state.user,
    userConnections: state.userConnections,
});

const mapDispatchToProps = (dispatch: any) => bindActionCreators({
    searchUserConnections: UserConnectionsActions.search,
}, dispatch);

/**
 * DocumentationOverview
 */
export class DocumentationOverviewComponent extends React.Component<IDocumentationOverviewProps, IDocumentationOverviewState> {
    private translate: Function;

    constructor(props: IDocumentationOverviewProps) {
        super(props);

        this.state = {
            alertIsVisible: false,
            alertVariation: 'success',
            alertTitle: '',
            alertMessage: '',
        };

        this.translate = (key: string, params: any) => translator('en-us', key, params);
    }

    componentDidMount() {
        const {
            user,
            userConnections,
        } = this.props;
        document.title = `Therr for Business | ${this.translate('pages.settings.pageTitle')}`;
    }

    onSubmitPasswordChange = (oldPassword, newPassword) => UsersService.changePassword({
        oldPassword,
        newPassword,
        email: this.props.user.details.email,
        userName: this.props.user.details.userName,
    })
        .then(() => {
            this.setState({
                alertTitle: 'Password Updated',
                alertMessage: 'Password was successfully updated',
                alertVariation: 'success',
            });
            this.toggleAlert(true);
        })
        .catch((error) => {
            if (error.message === 'User not found') {
                this.onValidationError('User Not Found', 'No user found with the provided credentials');
            }
            if (error.message === 'User/password combination is incorrect') {
                this.onValidationError('Update failed', 'Provided (old) password does not match current password or one-time password');
            }
        });

    toggleAlert = (show?: boolean) => {
        this.setState({
            alertIsVisible: show !== undefined ? show : !this.state.alertIsVisible,
        });
    };

    onValidationError = (errTitle: string, errMsg: string) => {
        this.setState({
            alertTitle: errTitle,
            alertMessage: errMsg,
            alertVariation: 'danger',
        });
        this.toggleAlert(true);
    };

    public render(): JSX.Element | null {
        const { user } = this.props;
        const {
            alertIsVisible,
            alertVariation,
            alertTitle,
            alertMessage,
        } = this.state;

        return (
            <div id="page_documentation_overview" className="flex-box column">
                <div className="d-flex justify-content-between flex-wrap flex-md-nowrap align-items-center py-4">
                </div>

                <Row className="d-flex justify-content-around align-items-center py-4">
                    <Col xs={12} xl={10} xxl={8}>
                        <Card>
                            <Card.Body>
                                <article>
                                    <h1 className="h2" id="overview">Overview </h1>
                                    <p><em>Therr for Business</em> is a local-first dashboard offering solutions for <b>location marketing</b>, <b>business metrics</b>, and <b>customer engagement</b>.
                                        We also partner and integrate with delivery service platforms (ie. <Card.Link href="https://appymeal.com/" target="_blank" >AppyMeal</Card.Link>, etc.).</p>
                                    <p>Getting started is <u>simple and free</u>:</p>
                                    <ol className="docs-list">
                                        <li>First, claim your space on the <Card.Link href="https://therr.app/" target="_blank" >mobile app</Card.Link> or <Link to="/claim-a-space">here on the dashboard</Link>.</li>
                                        <li>Next, add an <b>incentive</b> to reward customers for: (sharing on social media, reviewing your business, visiting your business, etc.)</li>
                                        <li>Finally, create a <b>marketing campaign</b>.</li>
                                    </ol>

                                    <h2 id="incentives-explained">Incentives Explained</h2>
                                    <p>Incentives are an easy way to initiate engagement at your business location. This is a perfect starting point for <b>more foot traffic</b>, <b>enhanced online presence</b>, and <b>customer loyalty</b>.
                                        Combining incentives with a marketing campaign will drive new customers to your location and build the foundation for repeat customers.
                                        Additionally, it provides a wealth of data and metrics that can be used to <b>optimize revenue</b> in the most efficient way possible.</p>

                                    <h2 id="getting-support">Getting support</h2>
                                    <p>If you have any questions, reach out to our support team 24/7. Please <Card.Link href="mailto: info@therr.com" target="_blank">contact us</Card.Link> and we&rsquo;ll get back to you in no time!</p>

                                    <h2 id="community">Community</h2>
                                    <ul className="docs-list">
                                        <li>Follow <Card.Link href="https://www.instagram.com/therr.for.business/" target="_blank">@therr.for.business</Card.Link> on Instagram.</li>
                                        <li>Follow <Card.Link href="https://twitter.com/therr_app" target="_blank">Therr App on Twitter</Card.Link>.</li>
                                        <li>Read and subscribe to <Card.Link href="https://business.therr.com/blog" target="_blank">{"The Official 'Therr For Business' Blog"}</Card.Link>.</li>
                                    </ul>
                                </article>
                            </Card.Body>
                        </Card>
                    </Col>
                </Row>
                <ToastContainer className="p-3" position={'bottom-end'}>
                    <Toast bg={alertVariation} show={alertIsVisible} onClose={() => this.toggleAlert(false)}>
                        <Toast.Header>
                            <img src="holder.js/20x20?text=%20" className="rounded me-2" alt="" />
                            <strong className="me-auto">{alertTitle}</strong>
                            {/* <small>11 mins ago</small> */}
                        </Toast.Header>
                        <Toast.Body>{alertMessage}</Toast.Body>
                    </Toast>
                </ToastContainer>
            </div>
        );
    }
}

export default withNavigation(connect(mapStateToProps, mapDispatchToProps)(DocumentationOverviewComponent));
