import React from 'react';
import { View, Text } from 'react-native';

const ListEmpty = ({
    theme,
    text,
}) => (
    <View style={theme.styles.sectionContainer}>
        <Text style={theme.styles.sectionDescription}>
            {text}
        </Text>
    </View>
);

export default ListEmpty;
