import * as React from 'react';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import { Location, NavigateFunction } from 'react-router-dom';
import qs from 'qs';
import translator from '../services/translator';
import RegisterForm from '../components/forms/RegisterForm';
import UsersActions from '../redux/actions/UsersActions';
import withNavigation from '../wrappers/withNavigation';

interface IRegisterRouterProps {
    navigation: {
        navigate: NavigateFunction;
    }
}

interface IRegisterDispatchProps {
    register: Function;
    location: Location;
}

type IStoreProps = IRegisterDispatchProps

// Regular component props
interface IRegisterProps extends IRegisterRouterProps, IStoreProps {
}

interface IRegisterState {
    errorMessage: string;
    inputs: any;
    inviteCode: string;
}

const mapStateToProps = (state: any) => ({
});

const mapDispatchToProps = (dispatch: any) => bindActionCreators({
    register: UsersActions.register,
}, dispatch);

/**
 * Login
 */
export class RegisterComponent extends React.Component<IRegisterProps, IRegisterState> {
    private translate: Function;

    constructor(props: IRegisterProps) {
        super(props);

        const searchParams = qs.parse(props.location?.search, { ignoreQueryPrefix: true });

        this.state = {
            errorMessage: '',
            inputs: {},
            inviteCode: searchParams?.['invite-code'] as string || '',
        };

        this.translate = (key: string, params: any) => translator('en-us', key, params);
    }

    componentDidMount() { // eslint-disable-line class-methods-use-this
        document.title = `Therr | ${this.translate('pages.register.pageTitle')}`;

        if (window?.location) {
            // eslint-disable-next-line no-inner-declarations
            function isIpadOS() {
                return navigator?.maxTouchPoints > 2 && /MacIntel/.test(navigator.platform);
            }
            if (navigator?.userAgent?.toLowerCase()?.indexOf('android') > -1 && (navigator as any).brave?.isBrave?.name !== 'isBrave') {
                // window.location.href = 'https://play.google.com/store/apps/details?id=app.therrmobile';
                window.location.href = 'market://details?id=app.therrmobile';
            } else if (navigator?.userAgent?.toLowerCase()?.indexOf('iphone') > -1 || isIpadOS()) {
                window.location.href = 'https://apps.apple.com/us/app/therr/id1569988763?platform=iphone';
            }
        }
    }

    register = (credentials: any) => {
        const { inviteCode } = this.state;
        this.props.register({
            ...credentials,
            inviteCode,
        }).then((response: any) => {
            this.props.navigation.navigate('/login', {
                state: {
                    successMessage: this.translate('pages.register.registerSuccess'),
                },
            });
        }).catch((error: any) => {
            if (error.statusCode === 400) {
                this.setState({
                    errorMessage: error.message,
                });
            } else {
                this.setState({
                    errorMessage: this.translate('pages.register.registerError'),
                });
            }
        });
    };

    public render(): JSX.Element | null {
        const { errorMessage, inviteCode } = this.state;

        return (
            <>
                <div id="page_register" className="flex-box space-evenly center row wrap-reverse">
                    <RegisterForm register={this.register} title={this.translate('pages.register.pageTitle')} inviteCode={inviteCode} />
                </div>
                {
                    errorMessage
                    && <div className="alert-error text-center">{errorMessage}</div>
                }
            </>
        );
    }
}

export default withNavigation(connect(mapStateToProps, mapDispatchToProps)(RegisterComponent));
