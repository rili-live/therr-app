import * as React from 'react';
import { View } from 'react-native';
import { Button } from 'react-native-elements';
import { PasswordRegex } from 'therr-js-utilities/constants';
import MaterialIcon from 'react-native-vector-icons/MaterialIcons';
import translator from '../../services/translator';
import { addMargins } from '../../styles';
import { buildStyles as buildFormStyles } from '../../styles/forms';
import { buildStyles as buildAuthFormStyles } from '../../styles/forms/authenticationForms';
import { buildStyles as buildAlertStyles } from '../../styles/alerts';
import Alert from '../../components/Alert';
import SquareInput from '../../components/Input/Square';
import PasswordRequirements from '../../components/Input/PasswordRequirements';

// Regular component props
interface IRegisterFormProps {
    alert?: string;
    onSuccess: Function;
    register: Function;
    title?: string;
    toggleEULA: Function;
    userSettings: any;
}

interface IRegisterFormState {
    inputs: any;
    passwordErrorMessage: string;
    prevRegisterError: string;
    isSubmitting: boolean;
    isPasswordEntryDirty: boolean;
}

/**
 * RegisterForm
 */
export class RegisterFormComponent extends React.Component<
    IRegisterFormProps,
    IRegisterFormState
> {
    private translate: Function;
    private themeAlerts = buildAlertStyles();
    private themeForms = buildFormStyles();
    private themeAuthForm = buildAuthFormStyles();

    constructor(props: IRegisterFormProps) {
        super(props);

        this.state = {
            inputs: {},
            passwordErrorMessage: '',
            prevRegisterError: '',
            isSubmitting: false,
            isPasswordEntryDirty: false,
        };

        this.themeAlerts = buildAlertStyles(props.userSettings.mobileThemeName);
        this.themeForms = buildFormStyles(props.userSettings.mobileThemeName);
        this.themeAuthForm = buildAuthFormStyles(props.userSettings.mobileThemeName);
        this.translate = (key: string, params: any) =>
            translator('en-us', key, params);
    }

    isRegisterFormDisabled = () => {
        return !this.state.inputs.email ||
            !this.state.inputs.password ||
            !this.isFormValid();
    }

    isFormValid = () => {
        return this.state.inputs.password === this.state.inputs.repeatPassword;
    }

    onSubmit = () => {
        const { inputs } = this.state;

        if (!this.isRegisterFormDisabled()) {
            if (!PasswordRegex.test(inputs.password)) {
                this.setState({
                    prevRegisterError: this.translate(
                        'forms.registerForm.errorMessages.passwordInsecure'
                    ),
                });
                return;
            }

            const creds = {
                ...inputs,
            };
            delete creds.repeatPassword;

            this.setState({
                isSubmitting: true,
            });

            this.props
                .register(creds)
                .then(() => {
                    this.props.onSuccess();
                })
                .catch((error: any) => {
                    if (
                        error.statusCode === 400
                    ) {
                        this.setState({
                            prevRegisterError: `${error.message}${
                                error.parameters
                                    ? ' error (' + error.parameters.toString() + ')'
                                    : ''
                            }`,
                        });
                    } else {
                        this.setState({
                            prevRegisterError: this.translate(
                                'forms.registerForm.backendErrorMessage'
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
        const { inputs } = this.state;
        let passwordErrorMessage = '';

        const newInputChanges = {
            [name]: value,
        };

        if (name === 'repeatPassword') {
            if (inputs.password !== newInputChanges.repeatPassword) {
                passwordErrorMessage = this.translate('forms.registerForm.errorMessages.repeatPassword');
            }
        }

        if (name === 'password') {
            this.setState({
                isPasswordEntryDirty: true,
            });
        }

        if (name === 'password' && inputs.repeatPassword) {
            if (inputs.repeatPassword !== newInputChanges.password) {
                passwordErrorMessage = this.translate('forms.registerForm.errorMessages.repeatPassword');
            }
        }

        this.setState({
            inputs: {
                ...inputs,
                ...newInputChanges,
            },
            prevRegisterError: '',
            passwordErrorMessage,
        });
    };

    public render(): JSX.Element | null {
        const {
            isPasswordEntryDirty,
            passwordErrorMessage,
            prevRegisterError,
        } = this.state;
        const { toggleEULA } = this.props;

        return (
            <>
                <SquareInput
                    autoCapitalize="none"
                    autoCorrect={false}
                    placeholder={this.translate(
                        'forms.registerForm.labels.email'
                    )}
                    value={this.state.inputs.email}
                    onChangeText={(text) =>
                        this.onInputChange('email', text)
                    }
                    rightIcon={
                        <MaterialIcon
                            name="email"
                            size={24}
                            color={this.themeAlerts.colorVariations.primary3Fade}
                        />
                    }
                    themeForms={this.themeForms}
                />
                {
                    isPasswordEntryDirty &&
                        <PasswordRequirements translate={this.translate} password={this.state.inputs.password} themeForms={this.themeForms} />
                }
                {/* TODO: RMOBILE-26: Centralize password requirements */}
                <SquareInput
                    autoCapitalize="none"
                    autoCorrect={false}
                    placeholder={this.translate(
                        'forms.registerForm.labels.password'
                    )}
                    value={this.state.inputs.password}
                    onChangeText={(text) =>
                        this.onInputChange('password', text)
                    }
                    secureTextEntry={true}
                    rightIcon={
                        <MaterialIcon
                            name="vpn-key"
                            size={26}
                            color={this.themeAlerts.colorVariations.primary3Fade}
                        />
                    }
                    themeForms={this.themeForms}
                />
                <SquareInput
                    autoCapitalize="none"
                    autoCorrect={false}
                    placeholder={this.translate(
                        'forms.registerForm.labels.repeatPassword'

                    )}
                    value={this.state.inputs.repeatPassword}
                    onChangeText={(text) =>
                        this.onInputChange('repeatPassword', text)
                    }
                    errorMessage={passwordErrorMessage}
                    secureTextEntry={true}
                    onSubmitEditing={this.onSubmit}
                    rightIcon={
                        <MaterialIcon
                            name="lock"
                            size={26}
                            color={this.themeAlerts.colorVariations.primary3Fade}
                        />
                    }
                    themeForms={this.themeForms}
                />
                <Alert
                    containerStyles={addMargins({
                        marginBottom: 24,
                    })}
                    isVisible={!!prevRegisterError}
                    message={prevRegisterError}
                    type={'error'}
                    themeAlerts={this.themeAlerts}
                />
                <View style={this.themeAuthForm.styles.registerButtonContainer}>
                    <Button
                        buttonStyle={this.themeAuthForm.styles.button}
                        title={this.translate(
                            'forms.registerForm.buttons.register'
                        )}
                        onPress={this.onSubmit}
                        disabled={this.isRegisterFormDisabled()}
                    />
                </View>
                <View style={this.themeAuthForm.styles.moreLinksContainer}>
                    <Button
                        type="clear"
                        titleStyle={this.themeAuthForm.styles.buttonLink}
                        title={this.translate(
                            'forms.registerForm.buttons.eula'
                        )}
                        onPress={() => toggleEULA()}
                    />
                </View>
            </>
        );
    }
}

export default RegisterFormComponent;
