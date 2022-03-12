import * as React from 'react';
import { connect } from 'react-redux';
import { RouteComponentProps, withRouter } from 'react-router-dom';
import { bindActionCreators } from 'redux';
import {
    ButtonPrimary,
    Input,
} from 'therr-react/components';
import { UsersService } from 'therr-react/services';
import { IUserState } from 'therr-react/types';
import translator from '../services/translator';
import * as globalConfig from '../../../global-config';

interface IStoreProps extends IChangePasswordDispatchProps {
    user: IUserState;
}

interface IChangePasswordDispatchProps {
// Add your dispatcher properties here
}

interface IChangePasswordState {
    inputs: any;
    errorReason: string;
    isSuccess: boolean;
}

interface IChangePasswordProps extends RouteComponentProps<{}>, IStoreProps {
    inputs: any;
    errorReason: string;
    isSuccess: boolean;
}

// Environment Variables
const envVars = globalConfig[process.env.NODE_ENV];

const mapStateToProps = (state: any) => ({
    user: state.user,
});

const mapDispatchToProps = (dispatch: any) => bindActionCreators({
}, dispatch);

/**
 * ChangePassword
 */
export class ChangePasswordComponent extends React.Component<IChangePasswordProps & IChangePasswordDispatchProps, IChangePasswordState> {
    private translate: Function;

    constructor(props: IChangePasswordProps & IChangePasswordDispatchProps) {
        super(props);

        this.state = {
            inputs: {},
            errorReason: '',
            isSuccess: false,
        };

        this.translate = (key: string, params: any) => translator('en-us', key, params);
    }

    componentDidMount() { // eslint-disable-line class-methods-use-this
        document.title = `Therr | ${this.translate('pages.changePassword.pageTitle')}`;
    }

    isFormDisabled() {
        return !this.state.inputs.oldPassword || !this.state.inputs.newPassword || !this.isFormValid();
    }

    isFormValid() {
        return this.state.inputs.newPassword === this.state.inputs.newPasswordRepeat;
    }

    onSubmit = (event: any) => {
        event.preventDefault();
        UsersService.changePassword({
            oldPassword: this.state.inputs.oldPassword,
            newPassword: this.state.inputs.newPassword,
            email: this.props.user.details.email,
            userName: this.props.user.details.userName,
        })
            .then(() => {
                this.setState({
                    errorReason: '',
                    isSuccess: true,
                    inputs: {},
                });
            })
            .catch((error) => {
                if (error.message === 'User not found') {
                    this.setState({
                        errorReason: 'UserNotFound',
                    });
                }
                if (error.message === 'User/password combination is incorrect') {
                    this.setState({
                        errorReason: 'IncorrectPassword',
                    });
                }
            });
    }

    onInputChange = (name: string, value: string) => {
        const newInputChanges = {
            [name]: value,
        };

        this.setState({
            inputs: {
                ...this.state.inputs,
                ...newInputChanges,
            },
            errorReason: '',
        });
    }

    render() {
        const { errorReason, isSuccess } = this.state;

        return (
            <div id="page_change_password">
                <h1 className="margin-bot-lg">{this.translate('pages.changePassword.pageTitle')}</h1>

                <div className="form-field">
                    {
                        !errorReason && isSuccess
                        && <p className="alert-success">{this.translate('pages.changePassword.successMessage')}</p>
                    }
                    {
                        errorReason === 'UserNotFound'
                        && <p className="alert-error">{this.translate('pages.changePassword.failedMessageUserNotFound')}</p>
                    }
                    {
                        errorReason === 'IncorrectPassword'
                        && <p className="alert-error">{this.translate('pages.changePassword.failedMessageIncorrectPassword')}</p>
                    }
                    {
                        errorReason && errorReason !== 'UserNotFound' && errorReason !== 'IncorrectPassword'
                        && <p className="alert-error">{this.translate('pages.changePassword.failedMessage')}</p>
                    }
                </div>

                <div className="form-field">
                    {/* <label htmlFor="old_password">{this.translate('pages.changePassword.labels.oldPassword')}:</label> */}
                    <Input
                        type="password"
                        id="old_password"
                        name="oldPassword"
                        value={this.state.inputs.oldPassword}
                        onChange={this.onInputChange}
                        onEnter={this.onSubmit}
                        translate={this.translate}
                        validations={['isRequired']}
                        placeholder={this.translate('pages.changePassword.labels.oldPassword')}
                    />
                    {/* <label htmlFor="new_password">{this.translate('pages.changePassword.labels.newPassword')}:</label> */}
                    <Input
                        type="password"
                        id="new_password"
                        name="newPassword"
                        value={this.state.inputs.newPassword}
                        onChange={this.onInputChange}
                        onEnter={this.onSubmit}
                        translate={this.translate}
                        validations={['isRequired']}
                        placeholder={this.translate('pages.changePassword.labels.newPassword')}
                    />
                    {/* <label htmlFor="new_password_repeat">{this.translate('pages.changePassword.labels.newPasswordRepeat')}:</label> */}
                    <Input
                        type="password"
                        id="new_password_repeat"
                        name="newPasswordRepeat"
                        value={this.state.inputs.newPasswordRepeat}
                        onChange={this.onInputChange}
                        onEnter={this.onSubmit}
                        translate={this.translate}
                        validations={['isRequired']}
                        placeholder={this.translate('pages.changePassword.labels.newPasswordRepeat')}
                    />

                    <div className="form-field text-right">
                        <ButtonPrimary
                            id="email" text={this.translate('pages.changePassword.buttons.send')} onClick={this.onSubmit} disabled={this.isFormDisabled()} />
                    </div>
                </div>
            </div>
        );
    }
}

export default withRouter(connect(mapStateToProps, mapDispatchToProps)(ChangePasswordComponent));
