import React from 'react';
import { NativeSyntheticEvent, TextInputSubmitEditingEventData, View } from 'react-native';
import PhoneInput from 'react-native-phone-input';
import CountryPicker, { CountryCode } from 'react-native-country-picker-modal';
import phoneStyles from '../../styles/forms/phoneInput';
import { ITherrThemeColors } from '../../styles/themes';

interface IPhoneNumberInputProps {
    onSubmit?: (event: NativeSyntheticEvent<TextInputSubmitEditingEventData>) => void;
    onChangeText?: (value: string, isValid: boolean) => any;
    placeholder?: string;
    translate: Function;
    theme: {
        colors: ITherrThemeColors;
        styles: any;
    };
    themeForms: {
        colors: ITherrThemeColors;
        styles: any;
    };
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
    };

    onPressFlag = () => {
        this.setState({
            isCountryPickerVisible: true,
        });
    };

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
    };

    render() {
        const { onSubmit, placeholder, translate, theme, themeForms } = this.props;
        const { countryCode, isCountryPickerVisible } = this.state;

        return (
            <View style={phoneStyles.phoneInputContainer}>
                <PhoneInput
                    autoFormat={true}
                    ref={(ref) => { this.phone = ref; }}
                    onPressFlag={this.onPressFlag}
                    offset={0}
                    onChangePhoneNumber={this.onPhoneInputChange}
                    initialCountry={'us'}
                    flagStyle={theme.styles.displayNone}
                    style={themeForms.styles.phoneInput}
                    textProps={{
                        placeholder: placeholder || translate('forms.createConnection.placeholders.phone'),
                        selectionColor: theme.colors.selectionColor,
                        style: {...themeForms.styles.phoneInputText},
                        placeholderTextColor: theme.colors.placeholderTextColor,
                        onSubmitEditing: onSubmit,
                    }}
                />
                <View style={phoneStyles.countryFlagContainer}>
                    <CountryPicker
                        containerButtonStyle={phoneStyles.countryFlag}
                        onSelect={(value)=> this.onCountryCodeSelect(value)}
                        translation="common"
                        countryCode={countryCode}
                        visible={isCountryPickerVisible}
                        withAlphaFilter={true}
                    />
                </View>
            </View>
        );
    }
}

export default PhoneNumberInput;
