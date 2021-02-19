
import * as React from 'react';
import { View } from 'react-native';
import { Button } from 'react-native-elements';
import FontAwesomeIcon from 'react-native-vector-icons/FontAwesome5';
import translator from '../services/translator';
import { addMargins } from '../styles';
import formStyles, { loginForm as styles } from '../styles/forms';
import * as therrTheme from '../styles/themes';
import Alert from '../components/Alert';
import RoundInput from './Input/Round';

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
        this.setState({
            isSubmitting: true,
        });
        this.props
            .login({
                userName: userName && userName.toLowerCase(),
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
                                ? ' (' + error.parameters.join(', ') + ')'
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
            prevLoginError: '',
        });
    };

    public render(): JSX.Element | null {
        const { isSubmitting, prevLoginError } = this.state;
        const { navigation, userMessage } = this.props;

        return (
            <>
                <Alert
                    containerStyles={addMargins({
                        marginBottom: 24,
                    })}
                    isVisible={!!userMessage}
                    message={userMessage}
                    type={'success'}
                />
                <RoundInput
                    autoCapitalize="none"
                    autoCompleteType="email"
                    placeholder={this.translate(
                        'forms.loginForm.labels.userName'
                    )}
                    value={this.state.inputs.userName}
                    onChangeText={(text) =>
                        this.onInputChange('userName', text)
                    }
                    rightIcon={
                        <FontAwesomeIcon
                            name="user"
                            size={22}
                            color={therrTheme.colors.primary3}
                        />
                    }
                />
                <RoundInput
                    autoCapitalize="none"
                    autoCorrect={false}
                    autoCompleteType="password"
                    placeholder={this.translate(
                        'forms.loginForm.labels.password'
                    )}
                    value={this.state.inputs.password}
                    onChangeText={(text) =>
                        this.onInputChange('password', text)
                    }
                    secureTextEntry={true}
                    rightIcon={
                        <FontAwesomeIcon
                            name="lock"
                            size={22}
                            color={therrTheme.colors.primary3}
                        />
                    }
                />
                <View style={styles.submitButtonContainer}>
                    <Button
                        buttonStyle={styles.button}
                        disabledTitleStyle={formStyles.buttonTitleDisabled}
                        disabledStyle={formStyles.buttonDisabled}
                        title={this.translate(
                            'forms.loginForm.buttons.login'
                        )}
                        onPress={this.onSubmit}
                        loading={isSubmitting}
                        raised={true}
                        icon={
                            <FontAwesomeIcon
                                name="sign-in-alt"
                                size={18}
                                style={formStyles.buttonIcon}
                            />
                        }
                        iconRight
                    />
                </View>
                <Alert
                    containerStyles={addMargins({
                        marginBottom: 24,
                    })}
                    isVisible={!!prevLoginError}
                    message={prevLoginError}
                    type={'error'}
                />
                <View style={styles.moreLinksContainer}>
                    <Button
                        type="clear"
                        titleStyle={styles.buttonLink}
                        title={this.translate(
                            'forms.loginForm.buttons.signUp'
                        )}
                        onPress={() => navigation.navigate('Register')}
                    />
                    <Button
                        type="clear"
                        titleStyle={styles.buttonLink}
                        title={this.translate(
                            'forms.loginForm.buttons.forgotPassword'
                        )}
                        onPress={() => navigation.navigate('ForgotPassword')}
                    />
                </View>
            </>
        );
    }
}

export default LoginFormComponent;
