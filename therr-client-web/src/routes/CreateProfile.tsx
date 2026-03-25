import * as React from 'react';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import ReactGA from 'react-ga4';
import { ErrorCodes } from 'therr-js-utilities/constants';
import { IUserState } from 'therr-react/types';
import { ApiService } from 'therr-react/services';
import CreateProfileForm from '../components/forms/CreateProfileForm';
import VerifyPhoneCodeForm from '../components/forms/VerifyPhoneCodeForm';
import UsersActions from '../redux/actions/UsersActions';
import withNavigation from '../wrappers/withNavigation';
import withTranslation from '../wrappers/withTranslation';
import { routeAfterLogin } from './Login';

interface ICreateProfileRouterProps {
    navigation: any;
}

interface ICreateProfileDispatchProps {
    updateUser: Function;
}

type IStoreProps = ICreateProfileDispatchProps

// Regular component props
interface ICreateProfileProps extends ICreateProfileRouterProps, IStoreProps {
    translate: (key: string, params?: any) => string;
    user?: IUserState;
}

interface ICreateProfileState {
    errorMessage: string;
    inputs: any;
    isSubmitting: boolean;
    isVerifyingPhone: boolean;
    phoneNumber: string;
}

const mapStateToProps = (state: any) => ({
    user: state.user,
});

const mapDispatchToProps = (dispatch: any) => bindActionCreators({
    updateUser: UsersActions.update,
}, dispatch);

/**
 * Login
 */
export class CreateProfileComponent extends React.Component<ICreateProfileProps, ICreateProfileState> {
    constructor(props: ICreateProfileProps) {
        super(props);

        this.state = {
            errorMessage: '',
            inputs: {},
            isVerifyingPhone: false,
            isSubmitting: false,
            phoneNumber: '',
        };
    }

    componentDidMount() { // eslint-disable-line class-methods-use-this
        document.title = `Therr | ${this.props.translate('pages.createProfile.pageTitle')}`;
    }

    setError = (errorMessage: string) => {
        this.setState({ errorMessage, isSubmitting: false }, () => {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
    };

    onSubmitVerifyPhone = (updateArgs: any) => {
        const { user, updateUser } = this.props;

        this.setState({
            errorMessage: '',
            isSubmitting: true,
            phoneNumber: updateArgs.phoneNumber,
        });

        const argsWithoutPhone = { ...updateArgs };
        delete argsWithoutPhone.phoneNumber;
        // Extract isBusinessAccount to send to the API
        const { isBusinessAccount, ...profileArgs } = argsWithoutPhone;
        const updatePayload = {
            ...profileArgs,
            isBusinessAccount: !!isBusinessAccount,
        };

        updateUser(user.details.id, updatePayload).then(() => {
            ApiService.verifyPhone(updateArgs.phoneNumber).then(() => {
                ReactGA.event({
                    category: 'Registering',
                    action: 'verify_phone_desktop',
                });
                this.setState({
                    isVerifyingPhone: true,
                    isSubmitting: false,
                });
            }).catch((error) => {
                if (error?.errorCode === ErrorCodes.USER_EXISTS) {
                    this.setError(this.props.translate('pages.createProfile.phoneNumberAlreadyInUseError'));
                } else if (error?.errorCode === ErrorCodes.INVALID_REGION) {
                    this.setError(this.props.translate('pages.createProfile.phoneRegionNotSupportedError'));
                } else {
                    ReactGA.event({
                        category: 'Registering',
                        action: 'verify_phone_error_desktop',
                    });
                    this.setError(this.props.translate('pages.createProfile.verifyPhoneError'));
                }
            });
        }).catch((error: any) => {
            if (error.statusCode === 400) {
                this.setError(error.message);
            } else if (error.statusCode === 403) {
                this.setError(this.props.translate('pages.createProfile.authError'));
            } else {
                this.setError(this.props.translate('pages.createProfile.updateProfileError'));
            }
        });
    };

    onSubmitCode = (updateArgs: any) => {
        const { navigation, updateUser, user } = this.props;
        this.setState({
            errorMessage: '',
            isSubmitting: true,
        });
        ApiService.validateCode(updateArgs.verificationCode)
            .then(() => {
                updateUser(user.details.id, {
                    phoneNumber: this.state.phoneNumber,
                }).then(() => {
                    navigation.navigate(routeAfterLogin, {
                        state: {
                            successMessage: this.props.translate('pages.createProfile.createProfileSuccess'),
                        },
                    });
                }).catch((error: any) => {
                    if (error.statusCode === 400) {
                        this.setError(error.message);
                    } else if (error.statusCode === 403) {
                        this.setError(this.props.translate('pages.createProfile.authError'));
                    } else {
                        this.setError(this.props.translate('pages.createProfile.updateProfileError'));
                    }
                });
            })
            .catch((error) => {
                if (error.statusCode === 400) {
                    this.setError(this.props.translate('pages.createProfile.invalidCode'));
                } else {
                    this.setError(this.props.translate('pages.createProfile.verifyPhoneError'));
                }
            });
    };

    public render(): JSX.Element | null {
        const {
            errorMessage,
            isSubmitting,
            isVerifyingPhone,
            phoneNumber,
        } = this.state;

        return (
            <div id="page_create_profile" className="flex-box space-evenly center row wrap-reverse">
                {
                    isVerifyingPhone
                        && <VerifyPhoneCodeForm
                            errorMessage={errorMessage}
                            onSubmit={this.onSubmitCode}
                            onSubmitVerify={() => this.onSubmitVerifyPhone({
                                phoneNumber,
                            })}
                            isSubmitting={isSubmitting}
                            title={this.props.translate('pages.createProfile.pageTitleVerify')}
                        />
                }
                {
                    !isVerifyingPhone
                        && <CreateProfileForm
                            errorMessage={errorMessage}
                            onSubmit={this.onSubmitVerifyPhone}
                            isSubmitting={isSubmitting}
                            title={this.props.translate('pages.createProfile.pageTitle')}
                        />
                }
            </div>
        );
    }
}

export default withNavigation(withTranslation(connect(mapStateToProps, mapDispatchToProps)(CreateProfileComponent)));
