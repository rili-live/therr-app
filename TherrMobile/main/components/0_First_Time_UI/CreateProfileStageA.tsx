import React from 'react';
import { Platform, View } from 'react-native';
import { Button }  from 'react-native-elements';
import FontAwesomeIcon from 'react-native-vector-icons/FontAwesome5';
import Alert from '../Alert';
import SquareInput from '../Input/Square';
import { ITherrThemeColors, ITherrThemeColorVariations } from '../../styles/themes';
import { DEFAULT_FIRSTNAME, DEFAULT_LASTNAME } from '../../constants';

interface ICreateProfileStageAProps {
    errorMsg: string;
    inputs: any;
    isFormDisabled: boolean | undefined;
    onInputChange: Function;
    onSubmit: ((event: any) => void) | undefined;
    translate: Function;
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

const CreateProfileStageA: React.FunctionComponent<ICreateProfileStageAProps> = ({
    errorMsg,
    inputs,
    isFormDisabled,
    onInputChange,
    onSubmit,
    translate,
    themeAlerts,
    themeForms,
    themeSettingsForm,
}) => {

    if (inputs?.firstName !== DEFAULT_FIRSTNAME
        && inputs?.lastName !== DEFAULT_LASTNAME && onSubmit) {
        onSubmit(null);
    }

    return (
        <View style={themeSettingsForm.styles.userContainer}>
            <Alert
                containerStyles={themeSettingsForm.styles.alert}
                isVisible={errorMsg}
                message={errorMsg}
                type="error"
                themeAlerts={themeAlerts}
            />
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
                    onPress={onSubmit}
                    disabled={isFormDisabled}
                    raised={true}
                />
            </View>
        </View>
    );
};

export default CreateProfileStageA;
