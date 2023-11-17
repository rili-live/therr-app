import React from 'react';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import { NavigateFunction } from 'react-router-dom';
import {
    Col,
    Row,
    Button,
    Dropdown,
    ButtonGroup,
    Toast,
    ToastContainer,
} from 'react-bootstrap';
import { UserConnectionsActions } from 'therr-react/redux/actions';
import { UsersService } from 'therr-react/services';
import { IUserState, IUserConnectionsState } from 'therr-react/types';
import translator from '../services/translator';
import withNavigation from '../wrappers/withNavigation';
import AccountDetailsForm from '../components/forms/AccountDetailsForm';
import ChangePasswordForm from '../components/forms/ChangePasswordForm';
import { getWebsiteName, getBrandContext } from '../utilities/getHostContext';
import SubscriptionDetailsForm from '../components/forms/SubscriptionDetailsForm';

interface ISettingsRouterProps {
    navigation: {
        navigate: NavigateFunction;
    }
}

interface ISettingsDispatchProps {
    searchUserConnections: Function;
}

interface IStoreProps extends ISettingsDispatchProps {
    user: IUserState;
    userConnections: IUserConnectionsState;
}

// Regular component props
interface ISettingsProps extends ISettingsRouterProps, IStoreProps {
    onInitMessaging?: Function;
}

interface ISettingsState {
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
 * Settings
 */
export class SettingsComponent extends React.Component<ISettingsProps, ISettingsState> {
    private translate: Function;

    constructor(props: ISettingsProps) {
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
        document.title = `${getWebsiteName()} | ${this.translate('pages.settings.pageTitle')}`;
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
        const brandContext = getBrandContext();

        return (
            <div id="page_dashboard_overview" className="flex-box column">
                <div className="d-flex justify-content-between flex-wrap flex-md-nowrap align-items-center py-4">
                </div>

                <Row className="d-flex justify-content-around align-items-center py-4">
                    <Col xs={12} xl={10} xxl={8}>
                        <AccountDetailsForm
                            firstName={user?.details?.firstName}
                            lastName={user?.details?.lastName}
                            email={user?.details?.email}
                            phoneNumber={user?.details?.phoneNumber}
                        />
                    </Col>

                    <Col xs={12} xl={10} xxl={8}>
                        <ChangePasswordForm
                            onSubmit={this.onSubmitPasswordChange}
                            onValidate={this.onValidationError}
                            translate={this.translate}
                            toggleAlert={this.toggleAlert}
                        />
                    </Col>

                    <Col xs={12} xl={10} xxl={8}>
                        <SubscriptionDetailsForm
                            brandContext={brandContext}
                            user={user}
                        />
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

export default withNavigation(connect(mapStateToProps, mapDispatchToProps)(SettingsComponent));
