import React from 'react';
import { Platform, View } from 'react-native';
import { Button, Text }  from 'react-native-elements';
import FontAwesomeIcon from 'react-native-vector-icons/FontAwesome5';
import { Picker as ReactPicker } from '@react-native-picker/picker';
import Alert from '../../Alert';
import SquareInput from '../../Input/Square';
import { ITherrThemeColors, ITherrThemeColorVariations } from '../../../styles/themes';
// import { DEFAULT_FIRSTNAME, DEFAULT_LASTNAME } from '../../constants';

interface ICreateProfileDetailsProps {
    errorMsg: string;
    inputs: any;
    isFormDisabled: boolean | undefined;
    onInputChange: Function;
    onPickerChange: Function;
    onSubmit: ((shouldSkipAdvance: boolean) => void);
    translate: Function;
    theme: {
        styles: any;
    };
    themeAlerts: {
        colorVariations: ITherrThemeColorVariations;
        styles: any;
    };
    themeForms: {
        colors: ITherrThemeColors;
        styles: any;
    };
    themeSettingsForm: {
        styles: any;
    };
}

const CreateProfileDetails: React.FunctionComponent<ICreateProfileDetailsProps> = ({
    errorMsg,
    inputs,
    isFormDisabled,
    onInputChange,
    onPickerChange,
    onSubmit,
    translate,
    theme,
    themeAlerts,
    themeForms,
    themeSettingsForm,
}) => {

    // TODO: Debug and determine why we need this (Apple SSO BS?)
    // if (inputs?.firstName !== DEFAULT_FIRSTNAME
    //     && inputs?.lastName !== DEFAULT_LASTNAME
    //     && onSubmit) {
    //     onSubmit(false);
    // }

    return (
        <View style={themeSettingsForm.styles.userContainer}>
            <Alert
                containerStyles={themeSettingsForm.styles.alert}
                isVisible={errorMsg}
                message={errorMsg}
                type="error"
                themeAlerts={themeAlerts}
            />
            <View style={{ marginBottom: 50 }}>
                <Text style={theme.styles.sectionTitleSmallCenter}>
                    {translate(
                        'forms.settings.labels.accountTypeLabel'
                    )}
                </Text>
                <ReactPicker
                    selectedValue={inputs.accountType}
                    style={themeForms.styles.picker}
                    itemStyle={themeForms.styles.pickerItem}
                    onValueChange={(itemValue) =>
                        onPickerChange('accountType', itemValue)
                    }>
                    <ReactPicker.Item label={translate(
                        'forms.settings.labels.personalAccount'
                    )} value={'personal'} />
                    <ReactPicker.Item label={translate(
                        'forms.settings.labels.creatorAccount'
                    )} value={'creator'} />
                    <ReactPicker.Item label={translate(
                        'forms.settings.labels.businessAccount'
                    )} value={'business'} />
                </ReactPicker>
            </View>
            <SquareInput
                placeholder={translate(
                    'forms.settings.labels.userName'
                )}
                value={inputs.userName}
                onChangeText={(text) =>
                    onInputChange('userName', text)
                }
                rightIcon={
                    <FontAwesomeIcon
                        name="user"
                        size={22}
                        color={themeAlerts.colorVariations.primary3Fade}
                    />
                }
                themeForms={themeForms}
            />
            {
                Platform.OS !== 'ios' &&
                <>
                    <SquareInput
                        placeholder={translate(
                            'forms.settings.labels.firstName'
                        )}
                        value={inputs.firstName}
                        onChangeText={(text) =>
                            onInputChange('firstName', text)
                        }
                        rightIcon={
                            <FontAwesomeIcon
                                name="smile"
                                size={22}
                                color={themeAlerts.colorVariations.primary3Fade}
                            />
                        }
                        themeForms={themeForms}
                    />
                    <SquareInput
                        placeholder={translate(
                            'forms.settings.labels.lastName'
                        )}
                        value={inputs.lastName}
                        onChangeText={(text) =>
                            onInputChange('lastName', text)
                        }
                        rightIcon={
                            <FontAwesomeIcon
                                name="smile-beam"
                                size={22}
                                color={themeAlerts.colorVariations.primary3Fade}
                            />
                        }
                        themeForms={themeForms}
                    />
                </>
            }
            <View style={themeSettingsForm.styles.submitButtonContainer}>
                <Button
                    buttonStyle={themeForms.styles.button}
                    title={translate(
                        'forms.createProfile.buttons.submit'
                    )}
                    onPress={() => onSubmit(false)}
                    disabled={isFormDisabled}
                    raised={true}
                />
            </View>
        </View>
    );
};

export default CreateProfileDetails;
