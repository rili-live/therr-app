import React from 'react';
import { Pressable, StyleProp, Text, View } from 'react-native';
import { FlatList } from 'react-native-gesture-handler';
import { ITherrThemeColors } from '../styles/themes';
import { ViewStyle } from 'react-native';

interface ISearchTypeAheadProps {
    handleSelect: Function;
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
    searchPredictionResults,
    themeSearch,
}: ISearchTypeAheadProps) => {

    return (
        <View
            style={[themeSearch.styles.container, containerStyles || {}]}
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
                scrollEnabled={!disableScroll}
            />
        </View>
    );
};

export default React.memo(SearchTypeAheadResults);
