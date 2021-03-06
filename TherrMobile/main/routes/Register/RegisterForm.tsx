import * as React from 'react';
import { View } from 'react-native';
import { Button } from 'react-native-elements';
import CountryPicker, { CountryCode } from 'react-native-country-picker-modal';
import PhoneInput from 'react-native-phone-input';
import FontAwesomeIcon from 'react-native-vector-icons/FontAwesome5';
import translator from '../../services/translator';
import styles, { addMargins } from '../../styles';
import formStyles, { loginForm as loginFormStyles, phoneInput as phoneStyles } from '../../styles/forms';
import * as therrTheme from '../../styles/themes';
import Alert from '../../components/Alert';
import SquareInput from '../../components/Input/Square';

// Regular component props
interface IRegisterFormProps {
    alert?: string;
    onSuccess: Function;
    register: Function;
    title?: string;
}

interface IRegisterFormState {
    countryCode: CountryCode;
    inputs: any;
    isCountryPickerVisible: boolean;
    passwordErrorMessage: string;
    prevRegisterError: string;
    isSubmitting: boolean;
}

/**
 * RegisterForm
 */
export class RegisterFormComponent extends React.Component<
    IRegisterFormProps,
    IRegisterFormState
> {
    private phone: any;

    private translate: Function;

    constructor(props: IRegisterFormProps) {
        super(props);

        this.state = {
            countryCode: 'US',
            inputs: {},
            isCountryPickerVisible: false,
            passwordErrorMessage: '',
            prevRegisterError: '',
            isSubmitting: false,
        };

        this.translate = (key: string, params: any) =>
            translator('en-us', key, params);
    }

    isRegisterFormDisabled = () => {
        return !this.state.inputs.firstName ||
            !this.state.inputs.lastName ||
            !this.state.inputs.email ||
            !this.state.inputs.userName ||
            !this.state.inputs.password ||
            !this.isFormValid();
    }

    isFormValid = () => {
        return this.state.inputs.password === this.state.inputs.repeatPassword;
    }

    onSubmit = () => {
        const { inputs } = this.state;

        if (!this.phone.isValidNumber()) {
            this.setState({
                prevRegisterError: this.translate('forms.registerForm.errorMessages.invalidPhoneNumber'),
            });
            return;
        }

        const sanitizedPhoneNumber = this.phone.getValue();

        if (!this.isRegisterFormDisabled()) {
            const creds = {
                ...inputs,
                userName: inputs.userName.toLowerCase(),
                phoneNumber: sanitizedPhoneNumber,
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

    onCountryCodeSelect = (country) => {
        this.phone.selectCountry(country.cca2.toLowerCase());
        this.setState({
            countryCode: country.cca2,
            isCountryPickerVisible: false,
        });
    }

    onPhoneInputChange = (value: string, iso2: string) => {
        let newState: any = {
            inputs: {
                ...this.state.inputs,
                phoneNumber: value,
            },
        };
        if (iso2) {
            newState.countryCode = (iso2?.toUpperCase() as CountryCode);
        }
        this.setState(newState);
    }

    onPressFlag = () => {
        this.setState({
            isCountryPickerVisible: true,
        });
    }

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
            countryCode,
            isCountryPickerVisible,
            passwordErrorMessage,
            prevRegisterError,
        } = this.state;
        // const { alert, title } = this.props;

        return (
            <>
                <SquareInput
                    placeholder={this.translate(
                        'forms.registerForm.labels.firstName'
                    )}
                    value={this.state.inputs.firstName}
                    onChangeText={(text) =>
                        this.onInputChange('firstName', text)
                    }
                    rightIcon={
                        <FontAwesomeIcon
                            name="smile"
                            size={22}
                            color={therrTheme.colors.primary3Faded}
                        />
                    }
                />
                <SquareInput
                    placeholder={this.translate(
                        'forms.registerForm.labels.lastName'
                    )}
                    value={this.state.inputs.lastName}
                    onChangeText={(text) =>
                        this.onInputChange('lastName', text)
                    }
                    rightIcon={
                        <FontAwesomeIcon
                            name="smile-beam"
                            size={22}
                            color={therrTheme.colors.primary3Faded}
                        />
                    }
                />
                <SquareInput
                    autoCapitalize="none"
                    autoCorrect={false}
                    placeholder={this.translate(
                        'forms.registerForm.labels.userName'
                    )}
                    value={this.state.inputs.userName}
                    onChangeText={(text) =>
                        this.onInputChange('userName', text)
                    }
                    rightIcon={
                        <FontAwesomeIcon
                            name="user"
                            size={22}
                            color={therrTheme.colors.primary3Faded}
                        />
                    }
                />
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
                        <FontAwesomeIcon
                            name="envelope"
                            size={22}
                            color={therrTheme.colors.primary3Faded}
                        />
                    }
                />
                <View style={phoneStyles.phoneInputContainer}>
                    <PhoneInput
                        autoFormat={true}
                        ref={(ref) => { this.phone = ref; }}
                        onPressFlag={this.onPressFlag}
                        offset={0}
                        onChangePhoneNumber={this.onPhoneInputChange}
                        initialCountry={'us'}
                        flagStyle={styles.displayNone}
                        style={formStyles.phoneInput}
                        textProps={{
                            placeholder: this.translate('forms.registerForm.labels.mobilePhone'),
                            selectionColor: therrTheme.colors.ternary,
                            style: {...formStyles.phoneInputText},
                            placeholderTextColor: therrTheme.colors.placeholderTextColor,
                        }}
                    />
                    <View style={phoneStyles.countryFlagContainer}>
                        <CountryPicker
                            closeButtonStyle={phoneStyles.pickerCloseButton}
                            containerButtonStyle={phoneStyles.countryFlag}
                            onSelect={this.onCountryCodeSelect}
                            translation="common"
                            countryCode={countryCode}
                            // onSelect={this.onCountryCodeSelect}
                            visible={isCountryPickerVisible}
                            withAlphaFilter={true}
                        />
                    </View>
                </View>
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
                        <FontAwesomeIcon
                            name="lock"
                            size={22}
                            color={therrTheme.colors.primary3Faded}
                        />
                    }
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
                    rightIcon={
                        <FontAwesomeIcon
                            name="lock"
                            size={22}
                            color={therrTheme.colors.primary3Faded}
                        />
                    }
                />
                <Alert
                    containerStyles={addMargins({
                        marginBottom: 24,
                    })}
                    isVisible={!!prevRegisterError}
                    message={prevRegisterError}
                    type={'error'}
                />
                <View style={loginFormStyles.registerButtonContainer}>
                    <Button
                        buttonStyle={loginFormStyles.button}
                        title={this.translate(
                            'forms.registerForm.buttons.register'
                        )}
                        onPress={this.onSubmit}
                        disabled={this.isRegisterFormDisabled()}
                    />
                </View>
            </>
        );
    }
}

export default RegisterFormComponent;
