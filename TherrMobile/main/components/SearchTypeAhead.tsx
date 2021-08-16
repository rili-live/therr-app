import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { FlatList } from 'react-native-gesture-handler';
import { getTypeAheadStyles } from '../styles/modal';

interface ISearchTypeAheadProps {
    handleSelect: Function;
    searchPredictionResults: any[];
    viewPortHeight: number;
}

const renderListItem = (item, { handleSelect, styles }) => {
    return (
        <Pressable
            android_ripple={{}}
            onPress={() => handleSelect(item)}
            style={styles.itemContainer}
        >
            <Text style={styles.itemText}>{item.description}</Text>
        </Pressable>
    );
};

export default ({
    handleSelect,
    searchPredictionResults,
    viewPortHeight,
}: ISearchTypeAheadProps) => {
    const styles = getTypeAheadStyles({ viewPortHeight });

    return (
        <View
            style={styles.container}
            // childrenWrapperStyle={mapStyles.momentAlertOverlayContainer}
        >
            <FlatList
                data={searchPredictionResults}
                keyExtractor={(item) => String(item.place_id)}
                renderItem={({ item }) => renderListItem(item, { handleSelect, styles })}
                ItemSeparatorComponent={() => <View style={styles.separator} />}
                // ref={(component) => (this.flatListRef = component)}
                // style={styles.stretch}
                // onContentSizeChange={() => dms.length && this.flatListRef.scrollToEnd({ animated: true })}
            />
        </View>
    );
};

