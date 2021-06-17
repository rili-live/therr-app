import React from 'react';
import { GestureResponderEvent, View } from 'react-native';
import PhoneInput from 'react-native-phone-input';
import CountryPicker, { CountryCode } from 'react-native-country-picker-modal';
import styles from '../../styles';
import * as therrTheme from '../../styles/themes';
import formStyles, { settingsForm as settingsFormStyles, phoneInput as phoneStyles } from '../../styles/forms';

interface IPhoneNumberInputProps {
    onSubmit: ((event: GestureResponderEvent) => void) | undefined;
    onChangeText?: (value: string, isValid: boolean) => any;
    placeholder?: string;
    translate: Function;
}

interface IPhoneNumberInputState {
    countryCode: CountryCode;
    isCountryPickerVisible: boolean;
    phoneInputValue: string;
}

class PhoneNumberInput extends React.Component<IPhoneNumberInputProps, IPhoneNumberInputState> {
    private phone: any;

    constructor(props) {
        super(props);

        this.state = {
            countryCode: 'US',
            isCountryPickerVisible: false,
            phoneInputValue: props.phoneInputValue,
        };
    }

    onCountryCodeSelect = (country) => {
        this.phone.selectCountry(country.cca2.toLowerCase());
        this.setState({
            countryCode: country.cca2,
            isCountryPickerVisible: false,
        });
    }

    onPressFlag = () => {
        this.setState({
            isCountryPickerVisible: true,
        });
    }

    onPhoneInputChange = (value: string, iso2: string) => {
        const { onChangeText } = this.props;
        const newState: any = {
            phoneInputValue: value,
            prevConnReqError: '',
            prevConnReqSuccess: '',
        };
        if (iso2) {
            newState.countryCode = (iso2?.toUpperCase() as CountryCode);
        }
        this.setState(newState);
        if (onChangeText) {
            onChangeText(this.phone.getValue(), this.phone?.isValidNumber());
        }
    }

    render() {
        const { onSubmit, placeholder, translate } = this.props;
        const { countryCode, isCountryPickerVisible, phoneInputValue } = this.state;

        return (
            <View style={phoneStyles.phoneInputContainer}>
                <PhoneInput
                    autoFormat={true}
                    ref={(ref) => { this.phone = ref; }}
                    onPressFlag={this.onPressFlag}
                    offset={0}
                    onChangePhoneNumber={this.onPhoneInputChange}
                    onSubmitEditing={onSubmit}
                    initialCountry={'us'}
                    flagStyle={styles.displayNone}
                    style={formStyles.phoneInput}
                    textProps={{
                        placeholder: placeholder || translate('forms.createConnection.placeholders.phone'),
                        selectionColor: therrTheme.colors.ternary,
                        style: {...formStyles.phoneInputText},
                        placeholderTextColor: therrTheme.colors.placeholderTextColor,
                    }}
                />
                <View style={phoneStyles.countryFlagContainer}>
                    <CountryPicker
                        closeButtonStyle={phoneStyles.pickerCloseButton}
                        containerButtonStyle={phoneStyles.countryFlag}
                        onSelect={(value)=> this.onCountryCodeSelect(value)}
                        translation="common"
                        countryCode={countryCode}
                        // onSelect={this.onCountryCodeSelect}
                        visible={isCountryPickerVisible}
                        withAlphaFilter={true}
                    />
                </View>
            </View>
        );
    }
}

export default PhoneNumberInput;
