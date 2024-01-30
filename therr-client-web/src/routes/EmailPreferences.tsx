import * as React from 'react';
import { Link, NavigateFunction } from 'react-router-dom';
import {
    ButtonPrimary,
    CheckBox,
    Input,
} from 'therr-react/components';
import { UsersService } from 'therr-react/services';
import translator from '../services/translator';
import * as globalConfig from '../../../global-config';
import withNavigation from '../wrappers/withNavigation';

interface IEmailPreferencesRouterProps {
    location: Location;
    navigation: {
        navigate: NavigateFunction;
    }
}

interface IEmailPreferencesDispatchProps {
// Add your dispatcher properties here
}

interface IEmailPreferencesProps extends IEmailPreferencesRouterProps, IEmailPreferencesDispatchProps {}

interface IEmailPreferencesState {
    alertMessage: string;
    alertVariation: 'warning' | 'error' | 'success';
    email: string;
    isLoading: boolean;
    inputs: {
        settingsEmailLikes: boolean;
        settingsEmailInvites: boolean;
        settingsEmailMentions: boolean;
        settingsEmailMessages: boolean;
        settingsEmailReminders: boolean;
        settingsEmailBackground: boolean;
        settingsEmailMarketing: boolean;
        settingsEmailBusMarketing: boolean;
    };
}

// Environment Variables
const envVars = globalConfig[process.env.NODE_ENV];

/**
 * EmailPreferences
 */
export class EmailPreferencesComponent extends React.Component<IEmailPreferencesProps, IEmailPreferencesState> {
    private translate: Function;

    constructor(props: IEmailPreferencesProps & IEmailPreferencesDispatchProps) {
        super(props);

        this.state = {
            alertMessage: '',
            alertVariation: 'success',
            email: '',
            isLoading: true,
            inputs: {
                settingsEmailBusMarketing: true,
                settingsEmailMarketing: true,
                settingsEmailLikes: true,
                settingsEmailInvites: true,
                settingsEmailMentions: true,
                settingsEmailMessages: true,
                settingsEmailReminders: true,
                settingsEmailBackground: true,
            },
        };

        this.translate = (key: string, params: any) => translator('en-us', key, params);
    }

    componentDidMount() { // eslint-disable-line class-methods-use-this
        document.title = `Therr | ${this.translate('pages.emailPreferences.pageTitle')}`;
        const { location } = this.props;

        const urlParams = new URLSearchParams(location?.search);

        UsersService.getSubscriptionPreferences(urlParams.get('emailToken'))
            .then((response) => {
                const {
                    settingsEmailBusMarketing,
                    settingsEmailMarketing,
                    settingsEmailLikes,
                    settingsEmailInvites,
                    settingsEmailMentions,
                    settingsEmailMessages,
                    settingsEmailReminders,
                    settingsEmailBackground,
                } = response.data;
                this.setState({
                    inputs: {
                        settingsEmailBusMarketing: !!settingsEmailBusMarketing,
                        settingsEmailMarketing: !!settingsEmailMarketing,
                        settingsEmailLikes: !!settingsEmailLikes,
                        settingsEmailInvites: !!settingsEmailInvites,
                        settingsEmailMentions: !!settingsEmailMentions,
                        settingsEmailMessages: !!settingsEmailMessages,
                        settingsEmailReminders: !!settingsEmailReminders,
                        settingsEmailBackground: !!settingsEmailBackground,
                    },
                });
            })
            .catch((error) => {
                if (error.message === 'User not found') {
                    this.setState({
                        alertMessage: this.translate('pages.emailPreferences.failedMessageUserNotFound'),
                        alertVariation: 'warning',
                    });
                } else {
                    this.setState({
                        alertMessage: this.translate('pages.emailPreferences.failedToFetchMessage'),
                        alertVariation: 'error',
                    });
                }

                if (error?.statusCode === 401 || error?.statusCode === 403 || error?.message === 'invalid token') {
                    this.props.navigation.navigate('/login', {
                        state: {
                            errorMessage: this.translate('pages.emailPreferences.failedTokenMessage'),
                        },
                    });
                }
            })
            .finally(() => {
                this.setState({
                    isLoading: false,
                });
            });
    }

    onCheckboxChange: React.ChangeEventHandler<HTMLInputElement> = (event: React.ChangeEvent<HTMLInputElement>) => {
        const { name } = event.currentTarget;

        const newInputChanges = {
            [name]: !this.state.inputs[name],
        };

        this.setState({
            alertMessage: '',
            inputs: {
                ...this.state.inputs,
                ...newInputChanges,
            },
        });
    };

    onSubmit = (event: any) => {
        event.preventDefault();

        const { inputs } = this.state;
        const { location } = this.props;

        this.setState({
            isLoading: true,
        });

        const urlParams = new URLSearchParams(location?.search);
        UsersService.updateSubscriptionPreferences(inputs, urlParams.get('emailToken'))
            .then(() => {
                this.setState({
                    alertMessage: this.translate('pages.emailPreferences.successMessage'),
                    alertVariation: 'success',
                });
            })
            .catch((error) => {
                if (error.message === 'User not found') {
                    this.setState({
                        alertMessage: this.translate('pages.emailPreferences.failedMessageUserNotFound'),
                        alertVariation: 'warning',
                    });
                } else {
                    this.setState({
                        alertMessage: this.translate('pages.emailPreferences.failedToUpdateMessage'),
                        alertVariation: 'error',
                    });
                }
            })
            .finally(() => {
                this.setState({
                    isLoading: false,
                });
            });
    };

    onInputChange = (name: string, value: string) => {
        this.setState({
            email: value,
        });
    };

    render() {
        const {
            alertMessage,
            alertVariation,
            inputs,
            isLoading,
        } = this.state;

        return (
            <div id="page_email_preferences" className="flex-box space-evenly center row wrap-reverse">
                <div className="register-container">
                    <div className="flex fill max-wide-30">
                        <h1 className="text-center">{this.translate('pages.emailPreferences.pageTitle')}</h1>
                        {
                            alertMessage
                            && <div className="form-field">
                                {
                                    alertVariation === 'success'
                                    && <p className={`alert-${alertVariation}`}>{alertMessage}</p>
                                }
                                {
                                    alertVariation === 'error'
                                    && <p className={`alert-${alertVariation}`}>{alertMessage}</p>
                                }
                            </div>
                        }
                        <div className="form-field">
                            <h4>{this.translate('pages.emailPreferences.sectionHeaders.marketing')}:</h4>
                            <CheckBox
                                id="settingsEmailMarketing"
                                name="settingsEmailMarketing"
                                label={this.translate('pages.emailPreferences.labels.settingsEmailMarketing')}
                                value={inputs.settingsEmailMarketing}
                                onChange={this.onCheckboxChange}
                                className=""
                                disabled={isLoading}
                            />
                            <CheckBox
                                id="settingsEmailBusMarketing"
                                name="settingsEmailBusMarketing"
                                label={this.translate('pages.emailPreferences.labels.settingsEmailBusMarketing')}
                                value={inputs.settingsEmailBusMarketing}
                                onChange={this.onCheckboxChange}
                                className=""
                                disabled={isLoading}
                            />

                            <h4>{this.translate('pages.emailPreferences.sectionHeaders.social')}:</h4>
                            <CheckBox
                                id="settingsEmailLikes"
                                name="settingsEmailLikes"
                                label={this.translate('pages.emailPreferences.labels.settingsEmailLikes')}
                                value={inputs.settingsEmailLikes}
                                onChange={this.onCheckboxChange}
                                className=""
                                disabled={isLoading}
                            />
                            <CheckBox
                                id="settingsEmailInvites"
                                name="settingsEmailInvites"
                                label={this.translate('pages.emailPreferences.labels.settingsEmailInvites')}
                                value={inputs.settingsEmailInvites}
                                onChange={this.onCheckboxChange}
                                className=""
                                disabled={isLoading}
                            />
                            <CheckBox
                                id="settingsEmailMentions"
                                name="settingsEmailMentions"
                                label={this.translate('pages.emailPreferences.labels.settingsEmailMentions')}
                                value={inputs.settingsEmailMentions}
                                onChange={this.onCheckboxChange}
                                className=""
                                disabled={isLoading}
                            />
                            <CheckBox
                                id="settingsEmailMessages"
                                name="settingsEmailMessages"
                                label={this.translate('pages.emailPreferences.labels.settingsEmailMessages')}
                                value={inputs.settingsEmailMessages}
                                onChange={this.onCheckboxChange}
                                className=""
                                disabled={isLoading}
                            />
                            <CheckBox
                                id="settingsEmailReminders"
                                name="settingsEmailReminders"
                                label={this.translate('pages.emailPreferences.labels.settingsEmailReminders')}
                                value={inputs.settingsEmailReminders}
                                onChange={this.onCheckboxChange}
                                className=""
                                disabled={isLoading}
                            />
                            <CheckBox
                                id="settingsEmailBackground"
                                name="settingsEmailBackground"
                                label={this.translate('pages.emailPreferences.labels.settingsEmailBackground')}
                                value={inputs.settingsEmailBackground}
                                onChange={this.onCheckboxChange}
                                className=""
                                disabled={isLoading}
                            />

                            <div className="form-field text-right">
                                <ButtonPrimary
                                    id="email"
                                    text={this.translate('pages.emailPreferences.buttons.send')}
                                    onClick={this.onSubmit}
                                    disabled={isLoading}
                                />
                            </div>
                        </div>
                        <div className="text-center">
                            <Link to="/login">{this.translate('pages.emailPreferences.returnToLogin')}</Link>
                        </div>
                    </div>
                </div>
            </div>
        );
    }
}

export default withNavigation(EmailPreferencesComponent);
