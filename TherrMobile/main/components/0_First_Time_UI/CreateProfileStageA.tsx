import React from 'react';
import { GestureResponderEvent, View } from 'react-native';
import { Button }  from 'react-native-elements';
import FontAwesomeIcon from 'react-native-vector-icons/FontAwesome5';
import Alert from '../Alert';
import * as therrTheme from '../../styles/themes';
import formStyles, { settingsForm as settingsFormStyles } from '../../styles/forms';
import SquareInput from '../Input/Square';

interface ICreateProfileStageAProps {
    errorMsg: string;
    inputs: any;
    isFormDisabled: boolean | undefined;
    onInputChange: Function;
    onSubmit: ((event: GestureResponderEvent) => void) | undefined;
    translate: Function;
}

const CreateProfileStageA: React.FunctionComponent<ICreateProfileStageAProps> = ({
    errorMsg,
    inputs,
    isFormDisabled,
    onInputChange,
    onSubmit,
    translate,
}) => {
    return (
        <View style={settingsFormStyles.userContainer}>
            <Alert
                containerStyles={settingsFormStyles.alert}
                isVisible={errorMsg}
                message={errorMsg}
                type="error"
            />
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
                        color={therrTheme.colors.primary3Faded}
                    />
                }
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
                        color={therrTheme.colors.primary3Faded}
                    />
                }
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
                        color={therrTheme.colors.primary3Faded}
                    />
                }
            />
            <View style={settingsFormStyles.submitButtonContainer}>
                <Button
                    buttonStyle={formStyles.button}
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
}

export default CreateProfileStageA;
