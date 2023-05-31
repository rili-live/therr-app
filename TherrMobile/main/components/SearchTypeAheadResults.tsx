import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { FlatList } from 'react-native-gesture-handler';
import { ITherrThemeColors } from '../styles/themes';

interface ISearchTypeAheadProps {
    handleSelect: Function;
    searchPredictionResults: any[];
    themeSearch: {
        colors: ITherrThemeColors;
        styles: any;
    };
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
    handleSelect,
    searchPredictionResults,
    themeSearch,
}: ISearchTypeAheadProps) => {

    return (
        <View
            style={themeSearch.styles.container}
            // childrenWrapperStyle={mapStyles.momentAlertOverlayContainer}
        >
            <FlatList
                data={searchPredictionResults}
                keyExtractor={(item) => String(item.place_id)}
                renderItem={({ item }) => renderListItem(item, { handleSelect, styles: themeSearch.styles })}
                ItemSeparatorComponent={() => <View style={themeSearch.styles.separator} />}
                keyboardShouldPersistTaps="always"
                // ref={(component) => (this.flatListRef = component)}
                // style={styles.stretch}
                // onContentSizeChange={() => dms.length && this.flatListRef.scrollToEnd({ animated: true })}
            />
        </View>
    );
};

export default React.memo(SearchTypeAheadResults);
