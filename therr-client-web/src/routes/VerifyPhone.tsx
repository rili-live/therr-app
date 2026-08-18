import * as React from 'react';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import ReactGA from 'react-ga4';
import { Location } from 'react-router-dom';
import { ErrorCodes } from 'therr-js-utilities/constants';
import { IUserState } from 'therr-react/types';
import { ApiService } from 'therr-react/services';
import VerifyPhoneCodeForm from '../components/forms/VerifyPhoneCodeForm';
import VerifyPhoneNumberForm from '../components/forms/VerifyPhoneNumberForm';
import UsersActions from '../redux/actions/UsersActions';
import withNavigation from '../wrappers/withNavigation';
import withTranslation from '../wrappers/withTranslation';
import { getReturnTo, routeAfterLogin } from './Login';

interface IVerifyPhoneRouterProps {
    location: Location;
    navigation: any;
}

interface IVerifyPhoneDispatchProps {
    updateUser: Function;
}

type IStoreProps = IVerifyPhoneDispatchProps

// Regular component props
interface IVerifyPhoneProps extends IVerifyPhoneRouterProps, IStoreProps {
    translate: (key: string, params?: any) => string;
    user: IUserState;
}

interface IVerifyPhoneState {
    errorMessage: string;
    isSubmitting: boolean;
    isVerifyingCode: boolean;
    phoneNumber: string;
}

const mapStateToProps = (state: any) => ({
    user: state.user,
});

const mapDispatchToProps = (dispatch: any) => bindActionCreators({
    updateUser: UsersActions.update,
}, dispatch);

/**
 * Standalone phone (re)verification.
 *
 * The web counterpart of the mobile `CreateProfile` phone stage, and the fallback target for
 * the `therr.com/verify-phone` link — on a device with the app installed that URL opens the
 * app, and everywhere else it lands here. Both paths call the same two gateway endpoints, so
 * a user can finish verification on whichever surface they started on.
 *
 * Kept separate from `/create-profile` because that route is gated on
 * EMAIL_VERIFIED_MISSING_PROPERTIES — a user with a complete profile whose MOBILE_VERIFIED was
 * revoked (the server drops it whenever a profile save changes the number) does not match that
 * gate and would be redirected away from the one screen that could help them.
 */
export class VerifyPhoneComponent extends React.Component<IVerifyPhoneProps, IVerifyPhoneState> {
    constructor(props: IVerifyPhoneProps) {
        super(props);

        this.state = {
            errorMessage: '',
            isSubmitting: false,
            isVerifyingCode: false,
            phoneNumber: '',
        };
    }

    componentDidMount() {
        document.title = `Therr | ${this.props.translate('pages.verifyPhone.pageTitle')}`;
    }

    setError = (errorMessage: string) => {
        this.setState({ errorMessage, isSubmitting: false }, () => {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
    };

    /**
     * Dispatches the SMS. Also used as the code form's resend handler, which passes no
     * argument — hence the fallback to the number already in state.
     */
    onSubmitPhoneNumber = (args: any = {}) => {
        const phoneNumber = args.phoneNumber || this.state.phoneNumber;

        if (!phoneNumber) {
            return;
        }

        this.setState({
            errorMessage: '',
            isSubmitting: true,
            phoneNumber,
        });

        ApiService.verifyPhone(phoneNumber).then(() => {
            ReactGA.event({
                category: 'Registering',
                action: 'verify_phone_standalone_desktop',
            });
            this.setState({
                isVerifyingCode: true,
                isSubmitting: false,
            });
        }).catch((error) => {
            if (error?.errorCode === ErrorCodes.USER_EXISTS) {
                this.setError(this.props.translate('pages.verifyPhone.phoneNumberAlreadyInUseError'));
            } else if (error?.errorCode === ErrorCodes.INVALID_REGION) {
                this.setError(this.props.translate('pages.verifyPhone.phoneRegionNotSupportedError'));
            } else {
                ReactGA.event({
                    category: 'Registering',
                    action: 'verify_phone_standalone_error_desktop',
                });
                this.setError(this.props.translate('pages.verifyPhone.verifyPhoneError'));
            }
        });
    };

    onSubmitCode = (updateArgs: any) => {
        const {
            location, navigation, translate, updateUser, user,
        } = this.props;
        const { phoneNumber } = this.state;

        this.setState({
            errorMessage: '',
            isSubmitting: true,
        });

        ApiService.validateCode(updateArgs.verificationCode)
            .then(() => updateUser(user.details.id, { phoneNumber })
                .then(() => {
                    const returnTo = getReturnTo(location?.search);
                    const destination = returnTo || routeAfterLogin;

                    navigation.navigate(destination, {
                        state: {
                            successMessage: translate('pages.verifyPhone.verifyPhoneSuccess'),
                        },
                    });
                })
                .catch((error: any) => {
                    if (error.statusCode === 400) {
                        this.setError(error.message);
                    } else if (error.statusCode === 403) {
                        this.setError(translate('pages.verifyPhone.authError'));
                    } else {
                        this.setError(translate('pages.verifyPhone.updateProfileError'));
                    }
                }))
            .catch((error) => {
                if (error.statusCode === 400) {
                    this.setError(translate('pages.verifyPhone.invalidCode'));
                } else {
                    this.setError(translate('pages.verifyPhone.verifyPhoneError'));
                }
            });
    };

    public render(): JSX.Element | null {
        const { translate, user } = this.props;
        const {
            errorMessage,
            isSubmitting,
            isVerifyingCode,
        } = this.state;

        return (
            <div id="page_verify_phone" className="flex-box space-evenly center row wrap-reverse">
                {
                    isVerifyingCode
                        && <VerifyPhoneCodeForm
                            errorMessage={errorMessage}
                            onSubmit={this.onSubmitCode}
                            onSubmitVerify={() => this.onSubmitPhoneNumber()}
                            isSubmitting={isSubmitting}
                            title={translate('pages.verifyPhone.pageTitleVerify')}
                        />
                }
                {
                    !isVerifyingCode
                        && <VerifyPhoneNumberForm
                            errorMessage={errorMessage}
                            initialPhoneNumber={user?.details?.phoneNumber}
                            onSubmit={this.onSubmitPhoneNumber}
                            isSubmitting={isSubmitting}
                            title={translate('pages.verifyPhone.pageTitle')}
                        />
                }
            </div>
        );
    }
}

export default withNavigation(withTranslation(connect(mapStateToProps, mapDispatchToProps)(VerifyPhoneComponent)));
