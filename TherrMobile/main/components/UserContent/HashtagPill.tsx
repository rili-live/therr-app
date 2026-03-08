import React from 'react';
import { Chip } from 'react-native-paper';

export default ({ tag, onPress, hasIcon = true, styles }) => {
    return (
        <Chip
            compact
            mode="outlined"
            theme={{ roundness: 10 }}
            textStyle={[styles.buttonPillTitle, { fontSize: 13 }]}
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
