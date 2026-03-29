import React from 'react';
import { StyleSheet } from 'react-native';
import { Chip } from 'react-native-paper';

export default ({ tag, onPress, hasIcon = true, styles }) => {
    return (
        <Chip
            compact
            mode="outlined"
            theme={{ roundness: 10 }}
            textStyle={[styles.buttonPillTitle, localStyles.pillText]}
            style={[
                styles.buttonPill,
                styles.buttonPillContainer,
                { height: undefined },
            ]}
            onPress={() => onPress(tag)}
            onClose={hasIcon ? () => onPress(tag) : undefined}
        >
            {`#${tag}`}
        </Chip>
    );
};

const localStyles = StyleSheet.create({
    pillText: {
        fontSize: 13,
    },
});
