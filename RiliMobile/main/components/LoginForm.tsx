import * as React from 'react';
import { View, Text } from 'react-native';
import { Input } from 'react-native-elements';
import ButtonPrimary from 'rili-react/ButtonPrimary';
import translator from '../services/translator';
import { loginForm as styles } from '../styles/forms';

// Regular component props
interface ILoginFormProps {
    alert?: string;
    login: Function;
    title?: string;
}

interface ILoginFormState {
    inputs: any;
    prevLoginError: string;
    isSubmitting: boolean;
}

/**
 * LoginForm
 */
export class LoginFormComponent extends React.Component<
    ILoginFormProps,
    ILoginFormState
> {
    constructor(props: ILoginFormProps) {
        super(props);

        this.state = {
            inputs: {},
            prevLoginError: '',
            isSubmitting: false,
        };

        this.translate = (key: string, params: any) =>
            translator('en-us', key, params);
    }

    private translate: Function;

    isLoginFormDisabled() {
        return (
            !this.state.inputs.userName ||
            !this.state.inputs.password ||
            this.state.isSubmitting
        );
    }

    onSubmit = (event: any) => {
        event.preventDefault();
        const { password, rememberMe, userName } = this.state.inputs;
        switch (event.target.id) {
            case 'password':
            case 'user_name':
            case 'login':
                if (!this.isLoginFormDisabled()) {
                    this.setState({
                        isSubmitting: true,
                    });
                    this.props
                        .login({
                            userName,
                            password,
                            rememberMe,
                        })
                        .catch((error: any) => {
                            if (
                                error.statusCode === 401 ||
                                error.statusCode === 404
                            ) {
                                this.setState({
                                    prevLoginError: error.message,
                                    isSubmitting: false,
                                });
                            }
                        });
                }
                break;
            default:
        }
    };

    onInputChange = (value: string) => {
        const newInputChanges = {
            temp: value,
        };

        // if (name === 'userName') {
        //     newInputChanges[name] = value.toLowerCase();
        // }

        this.setState({
            inputs: {
                ...this.state.inputs,
                ...newInputChanges,
            },
            prevLoginError: '',
        });
    };

    public render(): JSX.Element | null {
        const { prevLoginError } = this.state;
        const { alert, title } = this.props;

        return (
            <View style={styles.loginContainer}>
                <Text>
                    {title ||
                        this.translate('components.loginForm.defaultTitle')}
                </Text>
                {alert && <View>{alert}</View>}
                {prevLoginError && <View>{prevLoginError}</View>}
                <label htmlFor="user_name">:</label>
                <Input
                    label={this.translate(
                        'components.loginForm.labels.userName'
                    )}
                    value={this.state.inputs.userName}
                    onChangeText={this.onInputChange}
                />

                <Input
                    label={this.translate(
                        'components.loginForm.labels.password'
                    )}
                    value={this.state.inputs.password}
                    onChangeText={this.onInputChange}
                    secureTextEntry={true}
                />

                <View>
                    <ButtonPrimary
                        id="login"
                        text={this.translate(
                            'components.loginForm.buttons.login'
                        )}
                        onClick={this.onSubmit}
                        disabled={this.isLoginFormDisabled()}
                    />
                </View>
            </View>
        );
    }
}

export default LoginFormComponent;
