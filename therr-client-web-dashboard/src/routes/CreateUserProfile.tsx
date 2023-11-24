import React from 'react';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import { NavigateFunction } from 'react-router-dom';
import ReactGA from 'react-ga4';
import {
    Col,
    Container,
    Row,
    Toast,
    ToastContainer,
} from 'react-bootstrap';
import { ErrorCodes } from 'therr-js-utilities/constants';
import { IUserState } from 'therr-react/types';
import { ApiService } from 'therr-react/services';
import { isValidPhoneNumber } from 'react-phone-number-input';
import translator from '../services/translator';
import withNavigation from '../wrappers/withNavigation';
import AccountDetailsForm from '../components/forms/AccountDetailsForm';
import { getWebsiteName } from '../utilities/getHostContext';
import UsersActions from '../redux/actions/UsersActions';
import { routeAfterLogin } from './Login';
import UserProfileForm, { orgTypeOptions } from '../components/forms/UserProfileForm';
import VerifyPhoneCodeForm from '../components/forms/VerifyPhoneCodeForm';

interface ICreateUserProfileRouterProps {
    navigation: {
        navigate: NavigateFunction;
    }
}

interface ICreateUserProfileDispatchProps {
    updateUser: Function;
}

interface IStoreProps extends ICreateUserProfileDispatchProps {
    user: IUserState;
}

// Regular component props
interface ICreateUserProfileProps extends ICreateUserProfileRouterProps, IStoreProps {
    onInitMessaging?: Function;
}

interface ICreateUserProfileState {
    alertIsVisible: boolean;
    alertVariation: string;
    alertTitle: string;
    alertMessage: string;
    isSubmitting: boolean;
    isVerifyingPhone: boolean;
    phoneNumber: string;
    isPhoneNumberValid?: boolean;
    firstName?: string;
    lastName?: string;
    userName?: string;
    organizationId: string | undefined;
    organizationName?: string;
    organizationType?: string;
    verificationCode: string;
}

const mapStateToProps = (state: any) => ({
    user: state.user,
});

const mapDispatchToProps = (dispatch: any) => bindActionCreators({
    updateUser: UsersActions.update,
}, dispatch);

/**
 * CreateUserProfile
 */
export class CreateUserProfileComponent extends React.Component<ICreateUserProfileProps, ICreateUserProfileState> {
    private translate: Function;

    constructor(props: ICreateUserProfileProps) {
        super(props);

        const defaultOrganization = props.user?.details?.userOrganizations && props.user?.details?.userOrganizations[0];

        this.state = {
            alertIsVisible: false,
            alertVariation: 'success',
            alertTitle: '',
            alertMessage: '',
            isSubmitting: false,
            isVerifyingPhone: false,
            phoneNumber: props.user?.details?.phoneNumber && props.user?.details?.phoneNumber !== 'apple-sso'
                ? props.user?.details?.phoneNumber
                : '',
            firstName: props.user?.details?.firstName || '',
            lastName: props.user?.details?.lastName || '',
            userName: props.user?.details?.userName || '',
            organizationId: defaultOrganization?.organizationId || undefined,
            organizationName: defaultOrganization?.organizationName || '',
            organizationType: defaultOrganization?.organizationBusinessType || orgTypeOptions[0].value,
            verificationCode: '',
        };

        this.translate = (key: string, params: any) => translator('en-us', key, params);
    }

    componentDidMount() {
        document.title = `${getWebsiteName()} | ${this.translate('pages.createProfile.pageTitle')}`;
    }

    onPhoneInputChange = (value: string) => {
        this.setState({
            phoneNumber: value || '+1',
            isPhoneNumberValid: isValidPhoneNumber(value || '+1'),
        });
    };

    onInputChange = (e) => {
        e.preventDefault();

        if (e.currentTarget.name === 'userName') {
            this.setState({
                userName: e.currentTarget.value.toLowerCase(),
            });
        } else {
            const newInputChanges: any = {
                [e.currentTarget.name]: e.currentTarget.value,
            };
            this.setState({
                ...newInputChanges,
            });
        }

        this.setState({
            alertTitle: '',
            alertMessage: '',
            alertVariation: '',
        });
    };

    onResendCode = (event: any) => {
        event.preventDefault();

        this.onSubmitVerifyPhone({});
    };

    onSubmitVerifyPhone = (updateArgs: any) => {
        const { user, updateUser } = this.props;
        const { phoneNumber, organizationId } = this.state;

        this.setState({
            isSubmitting: true,
            phoneNumber,
        });

        const modifiedUpdateArgs = {
            ...updateArgs,
            organization: {
                ...updateArgs.organization,
                id: organizationId,
            },
        };
        if (!updateArgs.organization?.name || !updateArgs.organization?.settingsGeneralBusinessType) {
            delete modifiedUpdateArgs.organization;
        }

        updateUser(user.details.id, modifiedUpdateArgs).then((response: any) => {
            if (response.organizations?.length) {
                this.setState({
                    organizationId: response.organizations[0].id,
                });
            }
            ApiService.verifyPhone(phoneNumber).then(() => {
                ReactGA.event({
                    category: 'Registering',
                    action: 'verify_phone_dashboard_desktop',
                });
                this.setState({
                    isVerifyingPhone: true,
                });
            }).catch((error) => {
                if (error?.errorCode === ErrorCodes.USER_EXISTS) {
                    this.onValidationError(
                        'Phone # Error',
                        this.translate('pages.createProfile.phoneNumberAlreadyInUseError'),
                    );
                } else {
                    ReactGA.event({
                        category: 'Registering',
                        action: 'verify_phone_dashboard_desktop_error',
                    });
                    this.onValidationError(
                        'Something Went Wrong',
                        this.translate('pages.createProfile.createProfileError'),
                    );
                }
            }).finally(() => {
                this.setState({
                    isSubmitting: false,
                });
            });
        }).catch((error: any) => {
            if (error.statusCode === 400) {
                this.onValidationError(
                    'User Update Error',
                    error.message,
                );
            } else {
                this.onValidationError(
                    'User Update Error',
                    this.translate('pages.createProfile.createProfileError'),
                );
            }
        });
    };

    onSubmitCode = (updateArgs: any) => {
        const { navigation, updateUser, user } = this.props;
        this.setState({
            isSubmitting: true,
        });
        ApiService.validateCode(updateArgs.verificationCode)
            .then(() => {
                updateUser(user.details.id, {
                    phoneNumber: this.state.phoneNumber,
                }).then(() => {
                    this.onValidationSuccess(
                        'Successfully Verified',
                        'Your phone number and code were successfully verified!',
                    );
                    setTimeout(() => {
                        navigation.navigate(routeAfterLogin, {
                            state: {
                                successMessage: this.translate('pages.createProfile.createProfileSuccess'),
                            },
                        });
                    }, 1500);
                }).catch((error: any) => {
                    if (error.statusCode === 400) {
                        this.onValidationError(
                            'Verification Code Error',
                            error.message,
                        );
                    } else {
                        this.onValidationError(
                            'Verification Code Error',
                            this.translate('pages.createProfile.createProfileError'),
                        );
                    }
                });
            })
            .catch((error) => {
                if (
                    error.statusCode === 400
                ) {
                    this.onValidationError(
                        'Verification Code Error',
                        this.translate('pages.createProfile.invalidCode'),
                    );
                } else {
                    this.onValidationError(
                        'Verification Code Error',
                        this.translate('pages.createProfile.createProfileError'),
                    );
                }

                this.setState({
                    isSubmitting: false,
                });
            });
    };

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

    onValidationSuccess = (successTitle: string, successMsg: string) => {
        this.setState({
            alertTitle: successTitle,
            alertMessage: successMsg,
            alertVariation: 'success',
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
            isPhoneNumberValid,
            isVerifyingPhone,
            userName,
            firstName,
            lastName,
            organizationName,
            organizationType,
            phoneNumber,
            verificationCode,
        } = this.state;

        return (
            <div id="page_create_profile" className="flex-box center space-evenly row">
                <main>
                    <section className='d-flex align-items-center my-5 mt-lg-7 mb-lg-5'>
                        <Container>
                            <Row className="d-flex justify-content-around align-items-center py-4">
                                {
                                    !isVerifyingPhone
                                    && <Col xs={12} xl={10} xxl={8}>
                                        <UserProfileForm
                                            userName={userName}
                                            firstName={firstName}
                                            lastName={lastName}
                                            organizationName={organizationName}
                                            organizationType={organizationType}
                                            email={user?.details?.email}
                                            phoneNumber={phoneNumber}
                                            onPhoneInputChange={this.onPhoneInputChange}
                                            onInputChange={this.onInputChange}
                                            isPhoneNumberValid={isPhoneNumberValid}
                                            translate={this.translate}
                                            onSubmit={this.onSubmitVerifyPhone}
                                            user={user}
                                        />
                                    </Col>
                                }
                                {
                                    isVerifyingPhone
                                    && <Col xs={12} xl={10} xxl={8}>
                                        <VerifyPhoneCodeForm
                                            verificationCode={verificationCode}
                                            onInputChange={this.onInputChange}
                                            onResendCode={this.onResendCode}
                                            translate={this.translate}
                                            onSubmit={this.onSubmitCode}
                                        />
                                    </Col>
                                }
                                {/* <Col xs={12} xl={4}>
                                    <Row>
                                        <Col xs={12}>
                                            <ProfileCardWidget />
                                        </Col>
                                        <Col xs={12}>
                                            <ChoosePhotoWidget
                                                title="Select profile photo"
                                                photo={Profile3}
                                            />
                                        </Col>
                                    </Row>
                                </Col> */}
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
                        </Container>
                    </section>
                </main>
            </div>
        );
    }
}

export default withNavigation(connect(mapStateToProps, mapDispatchToProps)(CreateUserProfileComponent));
