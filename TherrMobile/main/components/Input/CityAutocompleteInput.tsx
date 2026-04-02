import React, { useCallback, useRef, useState } from 'react';
import { Dimensions, Keyboard, View } from 'react-native';
import { MapsService } from 'therr-react/services';
import RoundInput from './';
import SearchTypeAheadResults from '../SearchTypeAheadResults';
import { buildStyles as buildSearchStyles } from '../../styles/modal/typeAhead';

const { height: viewPortHeight } = Dimensions.get('window');

interface ICityAutocompleteInputProps {
    placeholder?: string;
    initialValue?: string;
    onCitySelect: (city: string, region: string) => void;
    theme: any;
    themeForms: any;
    themeSearch?: any;
    containerStyle?: any;
}

const CityAutocompleteInput = ({
    placeholder = 'City',
    initialValue = '',
    onCitySelect,
    theme: _theme,
    themeForms,
    themeSearch: themeSearchOverride,
    containerStyle,
}: ICityAutocompleteInputProps) => {
    const [inputText, setInputText] = useState(initialValue);
    const [predictions, setPredictions] = useState<any[]>([]);
    const [isDropdownVisible, setIsDropdownVisible] = useState(false);
    const [isSearching, setIsSearching] = useState(false);
    const throttleTimeoutId = useRef<ReturnType<typeof setTimeout> | null>(null);
    const themeSearch = themeSearchOverride || buildSearchStyles({ viewPortHeight });

    const handleTextChange = useCallback((text: string) => {
        setInputText(text);

        if (throttleTimeoutId.current) {
            clearTimeout(throttleTimeoutId.current);
        }

        if (!text || text.length < 2) {
            setPredictions([]);
            setIsDropdownVisible(false);
            return;
        }

        setIsSearching(true);
        setIsDropdownVisible(true);

        throttleTimeoutId.current = setTimeout(() => {
            MapsService.getPlacesSearchAutoComplete({
                latitude: '0',
                longitude: '0',
                input: text,
                types: '(cities)',
            }).then((response) => {
                setPredictions(response.data?.predictions || []);
            }).catch(() => {
                setPredictions([]);
            }).finally(() => {
                setIsSearching(false);
            });
        }, 400);
    }, []);

    const handleSelect = useCallback((item: any) => {
        Keyboard.dismiss();
        setIsDropdownVisible(false);

        const description = item.description || '';
        const parts = description.split(',');
        const city = parts[0]?.trim() || '';
        const region = parts.length > 1 ? parts[1]?.trim() : '';

        setInputText(city);
        onCitySelect(city, region);
    }, [onCitySelect]);

    return (
        <View style={[{ zIndex: 10 }, containerStyle]}>
            <RoundInput
                placeholder={placeholder}
                value={inputText}
                onChangeText={handleTextChange}
                onFocus={() => {
                    if (inputText && inputText.length >= 2) {
                        setIsDropdownVisible(true);
                    }
                }}
                onBlur={() => {
                    // Delay to allow press events on dropdown items
                    setTimeout(() => setIsDropdownVisible(false), 200);
                }}
                themeForms={themeForms}
            />
            {
                isDropdownVisible &&
                <SearchTypeAheadResults
                    containerStyles={{
                        top: themeForms.styles.inputContainerRound?.height || 59,
                    }}
                    handleSelect={handleSelect}
                    isSearching={isSearching}
                    searchPredictionResults={predictions}
                    themeSearch={themeSearch}
                    disableScroll
                />
            }
        </View>
    );
};

export default CityAutocompleteInput;
