import * as React from 'react';
import { Link, NavigateFunction } from 'react-router-dom';
import { Alert, Stack } from '@mantine/core';
import {
    MantineButton,
    MantineCheckbox,
} from 'therr-react/components/mantine';
import { UsersService } from 'therr-react/services';
import * as globalConfig from '../../../global-config';
import withNavigation from '../wrappers/withNavigation';
import withTranslation from '../wrappers/withTranslation';

interface IEmailPreferencesRouterProps {
    location: Location;
    navigation: {
        navigate: NavigateFunction;
    }
}

interface IEmailPreferencesDispatchProps {
// Add your dispatcher properties here
}

interface IEmailPreferencesProps extends IEmailPreferencesRouterProps, IEmailPreferencesDispatchProps {
    translate: (key: string, params?: any) => string;
}

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
    }

    componentDidMount() { // eslint-disable-line class-methods-use-this
        document.title = `Therr | ${this.props.translate('pages.emailPreferences.pageTitle')}`;
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
                        alertMessage: this.props.translate('pages.emailPreferences.failedMessageUserNotFound'),
                        alertVariation: 'warning',
                    });
                } else {
                    this.setState({
                        alertMessage: this.props.translate('pages.emailPreferences.failedToFetchMessage'),
                        alertVariation: 'error',
                    });
                }

                if (error?.statusCode === 401 || error?.statusCode === 403 || error?.message === 'invalid token') {
                    this.props.navigation.navigate('/login', {
                        state: {
                            errorMessage: this.props.translate('pages.emailPreferences.failedTokenMessage'),
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
                    alertMessage: this.props.translate('pages.emailPreferences.successMessage'),
                    alertVariation: 'success',
                });
            })
            .catch((error) => {
                if (error.message === 'User not found') {
                    this.setState({
                        alertMessage: this.props.translate('pages.emailPreferences.failedMessageUserNotFound'),
                        alertVariation: 'warning',
                    });
                } else {
                    this.setState({
                        alertMessage: this.props.translate('pages.emailPreferences.failedToUpdateMessage'),
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
                        <Stack gap="sm">
                            <h1 className="text-center">{this.props.translate('pages.emailPreferences.pageTitle')}</h1>
                            {
                                alertMessage
                                && <Alert
                                    color={alertVariation === 'success' ? 'green' : 'red'}
                                    variant="light"
                                >
                                    {alertMessage}
                                </Alert>
                            }

                            <h4>{this.props.translate('pages.emailPreferences.sectionHeaders.marketing')}:</h4>
                            <MantineCheckbox
                                id="settingsEmailMarketing"
                                name="settingsEmailMarketing"
                                label={this.props.translate('pages.emailPreferences.labels.settingsEmailMarketing')}
                                isChecked={inputs.settingsEmailMarketing}
                                onChange={this.onCheckboxChange}
                                disabled={isLoading}
                            />
                            <MantineCheckbox
                                id="settingsEmailBusMarketing"
                                name="settingsEmailBusMarketing"
                                label={this.props.translate('pages.emailPreferences.labels.settingsEmailBusMarketing')}
                                isChecked={inputs.settingsEmailBusMarketing}
                                onChange={this.onCheckboxChange}
                                disabled={isLoading}
                            />

                            <h4>{this.props.translate('pages.emailPreferences.sectionHeaders.social')}:</h4>
                            <MantineCheckbox
                                id="settingsEmailLikes"
                                name="settingsEmailLikes"
                                label={this.props.translate('pages.emailPreferences.labels.settingsEmailLikes')}
                                isChecked={inputs.settingsEmailLikes}
                                onChange={this.onCheckboxChange}
                                disabled={isLoading}
                            />
                            <MantineCheckbox
                                id="settingsEmailInvites"
                                name="settingsEmailInvites"
                                label={this.props.translate('pages.emailPreferences.labels.settingsEmailInvites')}
                                isChecked={inputs.settingsEmailInvites}
                                onChange={this.onCheckboxChange}
                                disabled={isLoading}
                            />
                            <MantineCheckbox
                                id="settingsEmailMentions"
                                name="settingsEmailMentions"
                                label={this.props.translate('pages.emailPreferences.labels.settingsEmailMentions')}
                                isChecked={inputs.settingsEmailMentions}
                                onChange={this.onCheckboxChange}
                                disabled={isLoading}
                            />
                            <MantineCheckbox
                                id="settingsEmailMessages"
                                name="settingsEmailMessages"
                                label={this.props.translate('pages.emailPreferences.labels.settingsEmailMessages')}
                                isChecked={inputs.settingsEmailMessages}
                                onChange={this.onCheckboxChange}
                                disabled={isLoading}
                            />
                            <MantineCheckbox
                                id="settingsEmailReminders"
                                name="settingsEmailReminders"
                                label={this.props.translate('pages.emailPreferences.labels.settingsEmailReminders')}
                                isChecked={inputs.settingsEmailReminders}
                                onChange={this.onCheckboxChange}
                                disabled={isLoading}
                            />
                            <MantineCheckbox
                                id="settingsEmailBackground"
                                name="settingsEmailBackground"
                                label={this.props.translate('pages.emailPreferences.labels.settingsEmailBackground')}
                                isChecked={inputs.settingsEmailBackground}
                                onChange={this.onCheckboxChange}
                                disabled={isLoading}
                            />

                            <div className="form-field text-right">
                                <MantineButton
                                    id="email"
                                    text={this.props.translate('pages.emailPreferences.buttons.send')}
                                    onClick={this.onSubmit}
                                    disabled={isLoading}
                                    fullWidth
                                />
                            </div>

                            <div className="text-center">
                                <Link to="/login">{this.props.translate('pages.emailPreferences.returnToLogin')}</Link>
                            </div>
                        </Stack>
                    </div>
                </div>
            </div>
        );
    }
}

export default withNavigation(withTranslation(EmailPreferencesComponent));
