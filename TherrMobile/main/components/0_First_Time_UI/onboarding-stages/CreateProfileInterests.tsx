import React from 'react';
import { Pressable, View } from 'react-native';
import { Button, Text } from 'react-native-elements';
import { ITherrThemeColors } from '../../../styles/themes';

interface ICreateProfileInterestsProps {
    availableInterests: any;
    isDisabled: boolean;
    onChange: (() => void);
    onSubmit: ((interests: any) => void);
    translate: Function;
    theme: {
        colors: ITherrThemeColors;
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

interface ICreateProfileInterestsState {
    availableInterests: {
        [key: string]: {
            [key: string]: any;
        };
    };
}

class CreateProfileInterests extends React.Component<ICreateProfileInterestsProps, ICreateProfileInterestsState> {
    constructor(props) {
        super(props);

        this.state = {
            availableInterests: { ...props.availableInterests },
        };
    }

    onPressInterest = (interest: any) => {
        const { availableInterests } = this.state;

        this.props.onChange();

        const modifiedInterests = {
            ...availableInterests,
        };

        modifiedInterests[interest.categoryKey].some((i, index) => {
            if (i.id === interest.id) {
                modifiedInterests[interest.categoryKey][index] = {
                    ...modifiedInterests[interest.categoryKey][index],
                    isEnabled: !modifiedInterests[interest.categoryKey][index].isEnabled,
                };
                return true;
            }

            return false;
        });

        this.setState({
            availableInterests: modifiedInterests,
        });
    };

    onSubmitInterests = () => {
        const { onSubmit} = this.props;
        const { availableInterests } = this.state;
        const interestsArray: {
            interestId: string;
            isEnabled: boolean;
        }[] = [];

        Object.keys(availableInterests).map((categoryTranslationKey) => {
            const interests = availableInterests[categoryTranslationKey];

            interests.map((interest) => {
                interestsArray.push({
                    interestId: interest.id,
                    isEnabled: !!interest.isEnabled,
                });
            });
        });

        onSubmit(interestsArray);
    };

    render() {
        const {
            isDisabled,
            translate,
            theme,
            themeForms,
            themeSettingsForm,
        } = this.props;
        const { availableInterests } = this.state;

        return (
            <View style={themeSettingsForm.styles.userContainer}>
                <View style={{ marginBottom: 50 }}>
                    {
                        Object.keys(availableInterests).map((categoryTranslationKey) => {
                            const interests = availableInterests[categoryTranslationKey];
                            return (
                                <View key={categoryTranslationKey} style={theme.styles.sectionContainer}>
                                    <Text style={[{ marginBottom: 20, color: 'black' }]}>
                                        {translate(categoryTranslationKey)}
                                    </Text>
                                    <View style={{ display: 'flex', flexDirection: 'row', flexWrap: 'wrap' }}>
                                        {
                                            interests.map((interest) => {
                                                const style = !!interest.isEnabled
                                                    ? { borderWidth: 1, borderRadius: 12, borderColor: theme.colors.selectionColor }
                                                    : {};
                                                return (
                                                    <Pressable
                                                        key={interest.id}
                                                        onPress={() => this.onPressInterest(interest)}
                                                        style={[style, { padding: 2, paddingHorizontal: 6, margin: 4 }]}
                                                    >
                                                        <Text>
                                                            {interest.emoji} {translate(interest.displayNameKey)}
                                                        </Text>
                                                    </Pressable>
                                                );
                                            })
                                        }
                                    </View>
                                </View>
                            );
                        })
                    }
                </View>
                <View style={themeSettingsForm.styles.submitButtonContainer}>
                    <Button
                        buttonStyle={themeForms.styles.button}
                        title={translate(
                            'forms.createProfile.buttons.submit'
                        )}
                        onPress={this.onSubmitInterests}
                        raised={true}
                        disabled={isDisabled}
                    />
                </View>
            </View>
        );
    }
}

export default CreateProfileInterests;
