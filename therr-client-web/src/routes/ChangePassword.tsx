import * as React from 'react';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import { Alert, Stack } from '@mantine/core';
import {
    MantineButton,
    MantineInput,
} from 'therr-react/components/mantine';
import { UsersService } from 'therr-react/services';
import { IUserState } from 'therr-react/types';
import translator from '../services/translator';
import * as globalConfig from '../../../global-config';
import withNavigation from '../wrappers/withNavigation';

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

interface IChangePasswordProps extends IStoreProps {
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
    private translate: (key: string, params?: any) => string;

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
    };

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
    };

    render() {
        const { errorReason, isSuccess } = this.state;

        return (
            <div id="page_change_password">
                <Stack gap="sm">
                    <h1 className="margin-bot-lg">{this.translate('pages.changePassword.pageTitle')}</h1>

                    {
                        !errorReason && isSuccess
                        && <Alert color="green" variant="light">{this.translate('pages.changePassword.successMessage')}</Alert>
                    }
                    {
                        errorReason === 'UserNotFound'
                        && <Alert color="red" variant="light">{this.translate('pages.changePassword.failedMessageUserNotFound')}</Alert>
                    }
                    {
                        errorReason === 'IncorrectPassword'
                        && <Alert color="red" variant="light">{this.translate('pages.changePassword.failedMessageIncorrectPassword')}</Alert>
                    }
                    {
                        errorReason && errorReason !== 'UserNotFound' && errorReason !== 'IncorrectPassword'
                        && <Alert color="red" variant="light">{this.translate('pages.changePassword.failedMessage')}</Alert>
                    }

                    <MantineInput
                        type="password"
                        id="old_password"
                        name="oldPassword"
                        value={this.state.inputs.oldPassword}
                        onChange={this.onInputChange}
                        onEnter={this.onSubmit}
                        translateFn={this.translate}
                        validations={['isRequired']}
                        label={this.translate('pages.changePassword.labels.oldPassword')}
                    />
                    <MantineInput
                        type="password"
                        id="new_password"
                        name="newPassword"
                        value={this.state.inputs.newPassword}
                        onChange={this.onInputChange}
                        onEnter={this.onSubmit}
                        translateFn={this.translate}
                        validations={['isRequired']}
                        label={this.translate('pages.changePassword.labels.newPassword')}
                    />
                    <MantineInput
                        type="password"
                        id="new_password_repeat"
                        name="newPasswordRepeat"
                        value={this.state.inputs.newPasswordRepeat}
                        onChange={this.onInputChange}
                        onEnter={this.onSubmit}
                        translateFn={this.translate}
                        validations={['isRequired']}
                        label={this.translate('pages.changePassword.labels.newPasswordRepeat')}
                    />

                    <div className="form-field text-right">
                        <MantineButton
                            id="email"
                            text={this.translate('pages.changePassword.buttons.send')}
                            onClick={this.onSubmit}
                            disabled={this.isFormDisabled()}
                            fullWidth
                        />
                    </div>
                </Stack>
            </div>
        );
    }
}

export default withNavigation(connect(mapStateToProps, mapDispatchToProps)(ChangePasswordComponent));
