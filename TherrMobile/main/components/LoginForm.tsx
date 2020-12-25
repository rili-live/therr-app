import * as React from 'react';
import { View } from 'react-native';
import { Button, Input } from 'react-native-elements';
import translator from '../services/translator';
import formStyles, { loginForm as styles } from '../styles/forms';
import * as therrTheme from '../styles/themes';
import Alert from '../components/Alert';

// Regular component props
interface ILoginFormProps {
    alert?: string;
    login: Function;
    navigation: any;
    userMessage?: string;
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
    private translate: Function;

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

    isLoginFormDisabled() {
        return (
            !this.state.inputs.userName ||
            !this.state.inputs.password ||
            this.state.isSubmitting
        );
    }

    onSubmit = () => {
        const { password, rememberMe, userName } = this.state.inputs;
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
                        error.statusCode === 400 ||
                        error.statusCode === 401 ||
                        error.statusCode === 404
                    ) {
                        this.setState({
                            prevLoginError: `${error.message}${
                                error.parameters
                                    ? ' error (' + error.parameters.toString() + ')'
                                    : ''
                            }`,
                        });
                    } else if (error.statusCode >= 500) {
                        this.setState({
                            prevLoginError: this.translate(
                                'forms.loginForm.backendErrorMessage'
                            ),
                        });
                    }
                    this.setState({
                        isSubmitting: false,
                    });
                });
        }
    };

    onInputChange = (name: string, value: string) => {
        const newInputChanges = {
            [name]: value,
        };

        if (name === 'userName') {
            newInputChanges[name] = value.toLowerCase();
        }

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
        const { navigation, userMessage } = this.props;

        return (
            <View style={styles.loginContainer}>
                <Alert
                    containerStyles={{
                        marginBottom: 24,
                    }}
                    isVisible={!!userMessage}
                    message={userMessage}
                    type={'success'}
                />
                <Input
                    inputStyle={formStyles.input}
                    placeholder={this.translate(
                        'forms.loginForm.labels.userName'
                    )}
                    value={this.state.inputs.userName}
                    onChangeText={(text) =>
                        this.onInputChange('userName', text)
                    }
                    selectionColor={therrTheme.colors.ternary}
                />
                <Input
                    inputStyle={formStyles.input}
                    placeholder={this.translate(
                        'forms.loginForm.labels.password'
                    )}
                    value={this.state.inputs.password}
                    onChangeText={(text) =>
                        this.onInputChange('password', text)
                    }
                    secureTextEntry={true}
                    selectionColor={therrTheme.colors.ternary}
                />
                <View style={styles.submitButtonContainer}>
                    <Button
                        buttonStyle={styles.button}
                        title={this.translate(
                            'forms.loginForm.buttons.login'
                        )}
                        onPress={this.onSubmit}
                        disabled={this.isLoginFormDisabled()}
                    />
                </View>
                <Alert
                    containerStyles={{
                        marginBottom: 24,
                    }}
                    isVisible={!!prevLoginError}
                    message={prevLoginError}
                    type={'error'}
                />
                <View style={styles.moreLinksContainer}>
                    <Button
                        type='clear'
                        titleStyle={styles.buttonLink}
                        title={this.translate(
                            'forms.loginForm.buttons.signUp'
                        )}
                        onPress={() => navigation.navigate('Register')}
                    />
                    <Button
                        type='clear'
                        titleStyle={styles.buttonLink}
                        title={this.translate(
                            'forms.loginForm.buttons.forgotPassword'
                        )}
                        onPress={() => navigation.navigate('ForgotPassword')}
                    />
                </View>
            </View>
        );
    }
}

export default LoginFormComponent;
