import React from 'react';
import { Pressable, View } from 'react-native';
import { Button, Text } from 'react-native-elements';
import { ITherrThemeColors } from '../../../styles/themes';
import spacingStyles from '../../../styles/layouts/spacing';
import searchLoading from '../../../assets/search-loading.json';
import LottieView from 'lottie-react-native';

interface ICreateProfileInterestsProps {
    availableInterests: any;
    isDisabled: boolean;
    isLoading: boolean;
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
    submitButtonText: string;
}

interface ICreateProfileInterestsState {
    availableInterests: {
        [key: string]: {
            [key: string]: any;
        };
    };
}

class CreateProfileInterests extends React.Component<ICreateProfileInterestsProps, ICreateProfileInterestsState> {
    static getDerivedStateFromProps(nextProps: ICreateProfileInterestsProps, nextState: ICreateProfileInterestsState) {
        if (Object.keys(nextProps.availableInterests || {}).length > 0
            && Object.keys(nextState.availableInterests || {}).length < 1) {
            return {
                availableInterests: nextProps.availableInterests,
            };
        }

        return null;
    }

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
            isLoading,
            translate,
            theme,
            themeForms,
            themeSettingsForm,
            submitButtonText,
        } = this.props;
        const { availableInterests } = this.state;

        return (
            <View style={themeSettingsForm.styles.userContainer}>
                {
                    isLoading &&
                    <LottieView
                        source={searchLoading}
                        // resizeMode="cover"
                        resizeMode="contain"
                        speed={1}
                        autoPlay
                        loop
                        style={[{width: '100%', height: 65, marginVertical: 30 }]}
                    />
                }
                <View style={spacingStyles.marginBotLg}>
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
                        title={submitButtonText}
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
