import React from 'react';
import { ActivityIndicator, Pressable, StyleProp, Text, View } from 'react-native';
import { FlatList } from 'react-native-gesture-handler';
import { ITherrThemeColors } from '../styles/themes';
import { ViewStyle } from 'react-native';

interface ISearchTypeAheadProps {
    handleSelect: Function;
    isSearching?: boolean;
    searchPredictionResults: any[];
    themeSearch: {
        colors: ITherrThemeColors;
        styles: any;
    };
    disableScroll?: boolean;
    containerStyles?: StyleProp<ViewStyle>;
}

const renderListItem = (item, { handleSelect, styles }) => {
    return (
        <Pressable
            android_ripple={{}}
            onPress={(e) => {
                e.stopPropagation();
                handleSelect(item, true);
            }}
            style={styles.itemContainer}
        >
            <Text style={styles.itemText}>{item.description}</Text>
        </Pressable>
    );
};

const SearchTypeAheadResults = ({
    containerStyles,
    disableScroll,
    handleSelect,
    isSearching,
    searchPredictionResults,
    themeSearch,
}: ISearchTypeAheadProps) => {
    const getItemSeparator = () => <View style={themeSearch.styles.separator} />;

    return (
        <View
            style={[themeSearch.styles.container, containerStyles || {}]}
        >
            {isSearching && searchPredictionResults.length === 0 && (
                <View style={{ flexDirection: 'row', alignItems: 'center', padding: 12 }}>
                    <ActivityIndicator size="small" color={themeSearch.colors.primary3} style={{ marginRight: 8 }} />
                    <Text style={themeSearch.styles.itemText}>Searching...</Text>
                </View>
            )}
            <FlatList
                data={searchPredictionResults}
                keyExtractor={(item) => String(item.place_id || item.mapbox_id)}
                renderItem={({ item }) => renderListItem(item, { handleSelect, styles: themeSearch.styles })}
                ItemSeparatorComponent={getItemSeparator}
                keyboardShouldPersistTaps="always"
                scrollEnabled={!disableScroll}
            />
        </View>
    );
};

export default React.memo(SearchTypeAheadResults);
