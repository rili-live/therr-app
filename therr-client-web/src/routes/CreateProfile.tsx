import * as React from 'react';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import ReactGA from 'react-ga4';
import { ErrorCodes } from 'therr-js-utilities/constants';
import { IUserState } from 'therr-react/types';
import { ApiService } from 'therr-react/services';
import translator from '../services/translator';
import CreateProfileForm from '../components/forms/CreateProfileForm';
import VerifyPhoneCodeForm from '../components/forms/VerifyPhoneCodeForm';
import UsersActions from '../redux/actions/UsersActions';
import withNavigation from '../wrappers/withNavigation';
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
    private translate: Function;

    constructor(props: ICreateProfileProps) {
        super(props);

        this.state = {
            errorMessage: '',
            inputs: {},
            isVerifyingPhone: false,
            isSubmitting: false,
            phoneNumber: '',
        };

        this.translate = (key: string, params: any) => translator('en-us', key, params);
    }

    componentDidMount() { // eslint-disable-line class-methods-use-this
        document.title = `Therr | ${this.translate('pages.createProfile.pageTitle')}`;
    }

    onSubmitVerifyPhone = (updateArgs: any) => {
        const { user, updateUser } = this.props;

        this.setState({
            isSubmitting: true,
            phoneNumber: updateArgs.phoneNumber,
        });

        const argsWithoutPhone = { ...updateArgs };
        delete argsWithoutPhone.phoneNumber;

        updateUser(user.details.id, argsWithoutPhone).then((response: any) => {
            ApiService.verifyPhone(updateArgs.phoneNumber).then(() => {
                ReactGA.event({
                    category: 'Registering',
                    action: 'verify_phone_desktop',
                });
                this.setState({
                    isVerifyingPhone: true,
                });
            }).catch((error) => {
                if (error?.errorCode === ErrorCodes.USER_EXISTS) {
                    this.setState({
                        errorMessage: this.translate('pages.createProfile.phoneNumberAlreadyInUseError'),
                    });
                } else {
                    ReactGA.event({
                        category: 'Registering',
                        action: 'verify_phone_error_desktop',
                    });
                    this.setState({
                        errorMessage: this.translate('pages.createProfile.createProfileError'),
                    });
                }
            }).finally(() => {
                this.setState({
                    isSubmitting: false,
                });
            });
        }).catch((error: any) => {
            if (error.statusCode === 400) {
                this.setState({
                    errorMessage: error.message,
                });
            } else {
                this.setState({
                    errorMessage: this.translate('pages.createProfile.createProfileError'),
                });
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
                    navigation.navigate(routeAfterLogin, {
                        state: {
                            successMessage: this.translate('pages.createProfile.createProfileSuccess'),
                        },
                    });
                }).catch((error: any) => {
                    if (error.statusCode === 400) {
                        this.setState({
                            errorMessage: error.message,
                        });
                    } else {
                        this.setState({
                            errorMessage: this.translate('pages.createProfile.createProfileError'),
                        });
                    }
                });
            })
            .catch((error) => {
                if (
                    error.statusCode === 400
                ) {
                    this.setState({
                        errorMessage: this.translate('pages.createProfile.invalidCode'),
                    });
                } else {
                    this.setState({
                        errorMessage: this.translate('pages.createProfile.createProfileError'),
                    });
                }

                this.setState({
                    isSubmitting: false,
                });
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
            <>
                <div id="page_create_profile" className="flex-box space-evenly center row wrap-reverse">
                    {
                        isVerifyingPhone
                            && <VerifyPhoneCodeForm
                                onSubmit={this.onSubmitCode}
                                onSubmitVerify={() => this.onSubmitVerifyPhone({
                                    phoneNumber,
                                })}
                                isSubmitting={isSubmitting}
                                title={this.translate('pages.createProfile.pageTitleVerify')}
                            />
                    }
                    {
                        !isVerifyingPhone
                            && <CreateProfileForm
                                onSubmit={this.onSubmitVerifyPhone}
                                isSubmitting={isSubmitting}
                                title={this.translate('pages.createProfile.pageTitle')}
                            />
                    }
                </div>
                {
                    errorMessage
                    && <div className="alert-error text-center">{errorMessage}</div>
                }
            </>
        );
    }
}

export default withNavigation(connect(mapStateToProps, mapDispatchToProps)(CreateProfileComponent));
