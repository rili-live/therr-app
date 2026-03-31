import React from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { GooglePlacesAutocomplete } from 'react-native-google-places-autocomplete';
import { GOOGLE_APIS_ANDROID_KEY, GOOGLE_APIS_IOS_KEY } from 'react-native-dotenv';

interface ICityAutocompleteInputProps {
    placeholder?: string;
    initialValue?: string;
    onCitySelect: (city: string, region: string) => void;
    theme: any;
    themeForms: any;
    containerStyle?: any;
}

const CityAutocompleteInput = ({
    placeholder = 'City',
    initialValue = '',
    onCitySelect,
    theme,
    themeForms,
    containerStyle,
}: ICityAutocompleteInputProps) => {
    const apiKey = Platform.OS === 'ios' ? GOOGLE_APIS_IOS_KEY : GOOGLE_APIS_ANDROID_KEY;

    return (
        <View style={[{ zIndex: 10 }, containerStyle]}>
            <GooglePlacesAutocomplete
                placeholder={placeholder}
                textInputProps={{
                    defaultValue: initialValue,
                    placeholderTextColor: theme.colors.placeholderTextColor,
                }}
                onPress={(data, details) => {
                    let city = '';
                    let region = '';

                    if (details?.address_components) {
                        for (const component of details.address_components) {
                            if (component.types.includes('locality')) {
                                city = component.long_name;
                            }
                            if (component.types.includes('administrative_area_level_1')) {
                                region = component.long_name;
                            }
                        }
                    }

                    if (!city && data?.description) {
                        const parts = data.description.split(',');
                        city = parts[0]?.trim() || '';
                    }

                    onCitySelect(city, region);
                }}
                query={{
                    key: apiKey,
                    language: 'en',
                    types: '(cities)',
                }}
                fetchDetails
                enablePoweredByContainer={false}
                keyboardShouldPersistTaps="handled"
                debounce={400}
                minLength={2}
                styles={{
                    container: {
                        flex: 0,
                        position: 'relative',
                        zIndex: 10,
                    },
                    textInputContainer: {
                        backgroundColor: 'transparent',
                    },
                    textInput: {
                        ...StyleSheet.flatten(themeForms.styles.inputContainerRound),
                        color: theme.colors.textWhite,
                        fontSize: 16,
                        height: 59,
                    },
                    listView: {
                        backgroundColor: theme.colors.backgroundWhite,
                        borderRadius: 8,
                        marginTop: 2,
                        position: 'absolute',
                        top: 60,
                        left: 0,
                        right: 0,
                        zIndex: 1000,
                        elevation: 5,
                    },
                    row: {
                        backgroundColor: theme.colors.backgroundWhite,
                        paddingVertical: 12,
                        paddingHorizontal: 14,
                    },
                    separator: {
                        backgroundColor: theme.colors.accentDivider,
                        height: 1,
                    },
                    description: {
                        color: theme.colors.textWhite,
                        fontSize: 14,
                    },
                }}
            />
        </View>
    );
};

export default CityAutocompleteInput;
