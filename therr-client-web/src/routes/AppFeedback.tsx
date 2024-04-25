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

interface IAppFeedbackRouterProps {
    location: Location;
    navigation: {
        navigate: NavigateFunction;
    }
}

interface IAppFeedbackDispatchProps {
// Add your dispatcher properties here
}

interface IAppFeedbackProps extends IAppFeedbackRouterProps, IAppFeedbackDispatchProps {}

interface IAppFeedbackState {
    alertMessage: string;
    alertVariation: 'warning' | 'error' | 'success';
    email: string;
    isLoading: boolean;
    inputs: {
        isSocialHealth: boolean;
        isLoyaltyRewards: boolean;
        appFeedback: string;
    };
}

// Environment Variables
const envVars = globalConfig[process.env.NODE_ENV];

/**
 * AppFeedback
 */
export class AppFeedbackComponent extends React.Component<IAppFeedbackProps, IAppFeedbackState> {
    private translate: Function;

    constructor(props: IAppFeedbackProps & IAppFeedbackDispatchProps) {
        super(props);

        this.state = {
            alertMessage: '',
            alertVariation: 'success',
            email: '',
            isLoading: false,
            inputs: {
                isSocialHealth: false,
                isLoyaltyRewards: false,
                appFeedback: '',
            },
        };

        this.translate = (key: string, params: any) => translator('en-us', key, params);
    }

    componentDidMount() { // eslint-disable-line class-methods-use-this
        document.title = `Therr | ${this.translate('pages.appFeedback.pageTitle')}`;
        const { location } = this.props;

        const urlParams = new URLSearchParams(location?.search);
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
        const utmSource = urlParams.get('utm_source');
        const userId = urlParams.get('id');
        const formattedFeedback = `utmSource=${utmSource}, userId=${userId}, inputs=${JSON.stringify(inputs)}`;
        UsersService.sendFeedback(formattedFeedback)
            .then(() => {
                this.setState({
                    alertMessage: this.translate('pages.appFeedback.successMessage'),
                    alertVariation: 'success',
                });
            })
            .catch(() => {
                this.setState({
                    alertMessage: this.translate('pages.appFeedback.failedToUpdateMessage'),
                    alertVariation: 'error',
                });
            })
            .finally(() => {
                this.setState({
                    isLoading: false,
                });
            });
    };

    onInputChange = (name: string, value: string) => {
        this.setState({
            inputs: {
                ...this.state.inputs,
                [name]: value,
            },
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
            <div id="page_app_feedback" className="flex-box space-evenly center row wrap-reverse">
                <div className="register-container">
                    <div className="flex fill max-wide-30">
                        <h1 className="text-center">{this.translate('pages.appFeedback.pageTitle')}</h1>
                        {
                            alertMessage
                            && <div className="form-field text-center">
                                {
                                    alertVariation === 'success'
                                    && <p className={`alert-${alertVariation}`}>{alertMessage}</p>
                                }
                                {
                                    (alertVariation === 'error' || alertVariation === 'warning')
                                    && <p className={`alert-${alertVariation}`}>{alertMessage}</p>
                                }
                            </div>
                        }
                        <div className="form-field mb-2">
                            <h4 className="text-center">{this.translate('pages.appFeedback.sectionHeaders.response')}</h4>
                            <div className="mb-2 text-center">
                                <CheckBox
                                    id="isSocialHealth"
                                    name="isSocialHealth"
                                    label={this.translate('pages.appFeedback.labels.isSocialHealth')}
                                    value={inputs.isSocialHealth}
                                    onChange={this.onCheckboxChange}
                                    className="no-padding"
                                    disabled={isLoading}
                                />
                                <CheckBox
                                    id="isLoyaltyRewards"
                                    name="isLoyaltyRewards"
                                    label={this.translate('pages.appFeedback.labels.isLoyaltyRewards')}
                                    value={inputs.isLoyaltyRewards}
                                    onChange={this.onCheckboxChange}
                                    className="no-padding"
                                    disabled={isLoading}
                                />
                            </div>
                            <div className="text-center no-padding">
                                <label className="required" htmlFor="app_feedback">
                                    {this.translate('pages.appFeedback.labels.feedback')}:
                                </label>
                                <Input
                                    type="text"
                                    id="app_feedback"
                                    name="appFeedback"
                                    value={this.state.inputs.appFeedback}
                                    onChange={this.onInputChange}
                                    onEnter={this.onSubmit}
                                    translate={this.translate}
                                    validations={['isRequired']}
                                    placeholder={this.translate('pages.appFeedback.labels.missing')}
                                />
                            </div>

                            <div className="form-field text-right">
                                <ButtonPrimary
                                    id="email"
                                    text={this.translate('pages.appFeedback.buttons.send')}
                                    onClick={this.onSubmit}
                                    disabled={isLoading || !this.state.inputs.appFeedback}
                                />
                            </div>
                        </div>
                        <div className="text-center">
                            <Link to="/login">{this.translate('pages.appFeedback.returnToLogin')}</Link>
                        </div>
                    </div>
                </div>
            </div>
        );
    }
}

export default withNavigation(AppFeedbackComponent);
